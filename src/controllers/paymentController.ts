import type { Response } from 'express'
import type { AuthRequest } from '../middlewares/authMiddleware'
import {
  createPayment,
  confirmPayment,
  getPaymentById,
  listPayments,
  updatePaymentStatus,
  getPendingPaymentByMpOrderId,
  type PaymentType
} from '../services/paymentService'
import { updateMarketplaceOrderStatus, findPendingMarketplaceOrder } from '../services/marketplaceOrderService'
import { updateOrderStatus } from '../services/orderService'
import { getAssetById } from '../services/assetService'

const ALLOWED_PAYMENT_TYPES: PaymentType[] = ['DEPOSIT', 'FULL', 'MILESTONE', 'ASSET']

const parseId = (idParam: string): number | null => {
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return null
  }
  return id
}

const getUserCompanyId = async (userId: number): Promise<number | null> => {
  const { getDbPool } = await import('../config/database')
  const sql = (await import('mssql')).default
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('UserId', sql.Int, userId)
    .query(`SELECT CompanyId FROM [User] WHERE UserId = @UserId AND IsDeleted = 0`)

  return result.recordset[0]?.CompanyId ?? null
}

/**
 * Gets user's CompanyId, auto-creating a 'Personal Account' company if the user has none.
 */
const getOrCreateUserCompanyId = async (userId: number): Promise<number> => {
  const existing = await getUserCompanyId(userId)
  if (existing) return existing

  const { getDbPool } = await import('../config/database')
  const sql = (await import('mssql')).default
  const pool = await getDbPool()
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    const companyRes = await new sql.Request(transaction)
      .input('CompanyName', sql.NVarChar(200), 'Personal Account')
      .input('CompanyType', sql.NVarChar(50), 'BRAND')
      .query(`
        INSERT INTO [Company] (CompanyName, CompanyType, Status)
        OUTPUT INSERTED.CompanyId
        VALUES (@CompanyName, @CompanyType, 'ACTIVE')
      `)
    const newCompanyId = companyRes.recordset[0].CompanyId

    await new sql.Request(transaction)
      .input('CompanyId', sql.Int, newCompanyId)
      .input('UserId', sql.Int, userId)
      .query('UPDATE [User] SET CompanyId = @CompanyId WHERE UserId = @UserId')

    await transaction.commit()
    return newCompanyId
  } catch (err) {
    await transaction.rollback()
    throw err
  }
}

export const createPaymentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const { OrderId, AssetId, MpOrderId, CompanyId, Amount, PaymentType } = req.body

    if (Amount === undefined || Amount === null || typeof Amount !== 'number' || Amount <= 0) {
      res.status(400).json({ message: 'Amount is required and must be a positive number' })
      return
    }

    if (OrderId !== undefined && OrderId !== null && (!Number.isInteger(OrderId) || OrderId <= 0)) {
      res.status(400).json({ message: 'OrderId must be a positive integer or null' })
      return
    }

    if (AssetId !== undefined && AssetId !== null && (!Number.isInteger(AssetId) || AssetId <= 0)) {
      res.status(400).json({ message: 'AssetId must be a positive integer or null' })
      return
    }

    if (MpOrderId !== undefined && MpOrderId !== null && (!Number.isInteger(MpOrderId) || MpOrderId <= 0)) {
      res.status(400).json({ message: 'MpOrderId must be a positive integer or null' })
      return
    }

    if (PaymentType !== undefined && PaymentType !== null && !ALLOWED_PAYMENT_TYPES.includes(PaymentType as PaymentType)) {
      res.status(400).json({ message: `PaymentType must be one of: ${ALLOWED_PAYMENT_TYPES.join(', ')}` })
      return
    }

    const normalizedRole = req.user.roleName?.toUpperCase()
    let resolvedCompanyId: number

    if (normalizedRole === 'ADMIN' || normalizedRole === 'MANAGER') {
      if (!CompanyId || !Number.isInteger(CompanyId) || CompanyId <= 0) {
        res.status(400).json({ message: 'CompanyId is required for ADMIN/MANAGER' })
        return
      }
      resolvedCompanyId = CompanyId
    } else {
      // Auto-create a Personal Account company for users who don't have one yet
      resolvedCompanyId = await getOrCreateUserCompanyId(req.user.userId)
    }

    const payment = await createPayment({
      OrderId: OrderId ?? null,
      AssetId: AssetId ?? null,
      MpOrderId: MpOrderId ?? null,
      CompanyId: resolvedCompanyId,
      Amount,
      PaymentType: PaymentType ?? null
    })

    res.status(201).json({
      message: 'Create payment successfully',
      data: payment
    })
  } catch (error: any) {
    console.error('Error in createPaymentHandler:', error)

    if (error?.number === 547) {
      res.status(400).json({ message: 'OrderId, AssetId, or CompanyId does not exist' })
      return
    }

    res.status(500).json({ message: 'Server error while creating payment' })
  }
}

export const confirmPaymentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.body

    if (!paymentId || !Number.isInteger(paymentId) || paymentId <= 0) {
      res.status(400).json({ message: 'paymentId is required and must be a positive integer' })
      return
    }

    const payment = await confirmPayment(paymentId)

    // Sync MarketplaceOrder and CreativeOrder status if needed
    if (payment.PaymentType === 'ASSET') {
      try {
        let targetMpOrderId = payment.MpOrderId
        if (!targetMpOrderId && payment.AssetId) {
          const mpOrder = await findPendingMarketplaceOrder(payment.AssetId, payment.CompanyId)
          if (mpOrder) {
            targetMpOrderId = mpOrder.MpOrderId
          }
        }

        if (targetMpOrderId) {
          await updateMarketplaceOrderStatus(targetMpOrderId, 'PAID')
        }

        // Sync back to CreativeOrder if it exists
        if (payment.AssetId) {
          const asset = await getAssetById(payment.AssetId)
          if (asset && asset.OrderId) {
            await updateOrderStatus(asset.OrderId, 'COMPLETED')
          }
        }
      } catch (syncError) {
        console.error('Failed to sync order statuses in confirmPayment:', syncError)
      }
    }


    res.status(200).json({
      message: 'Confirm payment successfully',
      data: payment
    })
  } catch (error: any) {
    console.error('Error in confirmPaymentHandler:', error)

    if (error.message === 'PAYMENT_NOT_FOUND') {
      res.status(404).json({ message: 'Payment not found' })
      return
    }

    if (error.message === 'PAYMENT_CANNOT_CONFIRM') {
      res.status(400).json({ message: 'Only pending payments can be confirmed' })
      return
    }

    res.status(500).json({ message: 'Server error while confirming payment' })
  }
}

export const getPaymentDetailHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (typeof req.params.id !== 'string') {
      res.status(400).json({ message: 'Payment ID must be a string' })
      return
    }
    const paymentId = parseId(req.params.id)
    if (!paymentId) {
      res.status(400).json({ message: 'Payment ID is invalid' })
      return
    }

    const payment = await getPaymentById(paymentId)

    if (!payment) {
      res.status(404).json({ message: 'Payment not found' })
      return
    }

    res.status(200).json({
      message: 'Get payment detail successfully',
      data: payment
    })
  } catch (error) {
    console.error('Error in getPaymentDetailHandler:', error)
    res.status(500).json({ message: 'Server error while getting payment detail' })
  }
}

export const listPaymentsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const normalizedRole = req.user.roleName?.toUpperCase()
    let companyId: number | undefined

    if (normalizedRole !== 'ADMIN' && normalizedRole !== 'MANAGER') {
      const userCompanyId = await getUserCompanyId(req.user.userId)
      companyId = userCompanyId ?? undefined
    }

    const payments = await listPayments(companyId)

    res.status(200).json({
      message: 'Get payments successfully',
      data: payments
    })
  } catch (error) {
    console.error('Error in listPaymentsHandler:', error)
    res.status(500).json({ message: 'Server error while listing payments' })
  }
}



/**
 * Handle SePay Webhook Callback
 */
export const sepayWebhookHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sepayApiKey = process.env.SEPAY_API_KEY
    if (sepayApiKey) {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Apikey ') || authHeader.slice(7) !== sepayApiKey) {
        res.status(401).json({ success: false, message: 'Unauthorized' })
        return
      }
    }

    // 1. Chỉ xử lý các giao dịch tiền vào (transferType: "in")
    const transferType = req.body.transferType || req.body.transfer_type
    if (transferType && transferType !== 'in') {
      res.status(200).json({ success: true, message: 'Ignored non-incoming transaction' })
      return
    }

    // 2. Lấy nội dung chuyển khoản và mã giao dịch từ các field SePay gửi về
    const rawCode = req.body.code
    const rawContent = req.body.content || req.body.transactionContent || req.body.transaction_content || req.body.description

    if (!rawCode && !rawContent) {
      res.status(400).json({ success: false, message: 'Transaction code or content is required' })
      return
    }

    let referenceId: number | null = null

    // 1. Parse từ field code do SePay trích xuất (nếu có và hợp lệ)
    if (rawCode) {
      const codeStr = String(rawCode).trim()
      const matchDH = codeStr.match(/DH\s*[-_]?\s*(\d+)/i)
      if (matchDH) {
        referenceId = parseInt(matchDH[1])
      } else if (/^\d+$/.test(codeStr)) {
        referenceId = parseInt(codeStr)
      }
    }

    // 2. Nếu chưa lấy được, parse từ content/description bằng regex chặt chẽ
    if (!referenceId && rawContent) {
      const contentStr = String(rawContent).replace(/\s+/g, ' ').trim()
      const match = contentStr.match(/SEVQR\s+TKPIMV\s*(?:DH\s*[-_]?\s*)?(\d+)/i) ||
                    contentStr.match(/TKPIMV\s*(?:DH\s*[-_]?\s*)?(\d+)/i) ||
                    contentStr.match(/DH\s*[-_]?\s*(\d+)/i)
      if (match) {
        referenceId = parseInt(match[1])
      }
    }

    if (!referenceId) {
      res.status(400).json({ success: false, message: 'No valid transaction code found in payload' })
      return
    }

    console.log(`[SePay Webhook] Parsed Reference ID: ${referenceId}`)
    let paymentToConfirm: any = null

    // Try finding by PaymentId first
    const paymentByPid = await getPaymentById(referenceId)
    if (paymentByPid && paymentByPid.PaymentStatus === 'PENDING') {
      paymentToConfirm = paymentByPid
    } else {
      // Try finding by MpOrderId
      const paymentByOid = await getPendingPaymentByMpOrderId(referenceId)
      if (paymentByOid) {
        paymentToConfirm = paymentByOid
      }
    }

    if (!paymentToConfirm) {
      res.status(404).json({ success: false, message: 'Pending payment not found' })
      return
    }

    // 3. Kiểm tra số tiền chuyển khoản thực tế so với số tiền cần thanh toán
    const transferAmount = req.body.transferAmount || req.body.transfer_amount
    const amountPaid = Number(transferAmount)
    
    if (isNaN(amountPaid) || amountPaid < paymentToConfirm.Amount) {
      console.warn(`[SePay Webhook] Amount mismatch. Expected ${paymentToConfirm.Amount}, but received ${amountPaid}`)
      res.status(400).json({ 
        success: false, 
        message: `Amount mismatch. Expected: ${paymentToConfirm.Amount}, Received: ${amountPaid}` 
      })
      return
    }

    // Confirm payment
    const payment = await confirmPayment(paymentToConfirm.PaymentId)

    // Sync MarketplaceOrder status if needed
    if (payment.PaymentType === 'ASSET') {
      try {
        let targetMpOrderId = payment.MpOrderId
        if (!targetMpOrderId && payment.AssetId) {
          const mpOrder = await findPendingMarketplaceOrder(payment.AssetId, payment.CompanyId)
          if (mpOrder) {
            targetMpOrderId = mpOrder.MpOrderId
          }
        }

        if (targetMpOrderId) {
          await updateMarketplaceOrderStatus(targetMpOrderId, 'PAID')
        }

        // Sync back to CreativeOrder if it exists
        if (payment.AssetId) {
          const asset = await getAssetById(payment.AssetId)
          if (asset && asset.OrderId) {
            await updateOrderStatus(asset.OrderId, 'COMPLETED')
          }
        }
      } catch (syncError) {
        console.error('Failed to sync MarketplaceOrder/CreativeOrder in sepayWebhookHandler:', syncError)
      }
    }


    res.status(200).json({ success: true })
  } catch (error: any) {
    console.error('Error in sepayWebhookHandler:', error)
    res.status(500).json({ success: false, message: 'Server error while processing webhook' })
  }
}

export const paymentController = {
  create: createPaymentHandler,
  confirm: confirmPaymentHandler,
  getById: getPaymentDetailHandler,
  list: listPaymentsHandler,
  sepayWebhook: sepayWebhookHandler
}

export default paymentController
