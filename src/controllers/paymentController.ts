import type { Response } from 'express'
import type { AuthRequest } from '../middlewares/authMiddleware'
import {
  createPayment,
  confirmPayment,
  getPaymentById,
  listPayments,
  updatePaymentStatus,
  type PaymentType
} from '../services/paymentService'
import { createPaymentUrl, verifySecureHash } from '../services/vnpayService'
import { updateMarketplaceOrderStatus, findPendingMarketplaceOrder } from '../services/marketplaceOrderService'

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

export const createPaymentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const { OrderId, AssetId, CompanyId, Amount, PaymentType } = req.body

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
      const userCompanyId = await getUserCompanyId(req.user.userId)
      if (!userCompanyId) {
        res.status(400).json({ message: 'User is not associated with a company' })
        return
      }
      resolvedCompanyId = userCompanyId
    }

    const payment = await createPayment({
      OrderId: OrderId ?? null,
      AssetId: AssetId ?? null,
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

    // If it's an asset purchase, update the MarketplaceOrder too
    if (payment.PaymentType === 'ASSET' && payment.AssetId) {
      try {
        const mpOrder = await findPendingMarketplaceOrder(payment.AssetId, payment.CompanyId)
        if (mpOrder) {
          await updateMarketplaceOrderStatus(mpOrder.MpOrderId, 'PAID')
        }
      } catch (mpError) {
        console.error('Failed to update MarketplaceOrder status in confirmPayment:', mpError)
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
 * Handle VNPay payment URL creation
 */
export const createVnpayUrlHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const { paymentId, bankCode, locale } = req.body

    if (!paymentId || !Number.isInteger(paymentId)) {
      res.status(400).json({ message: 'paymentId is required' })
      return
    }

    const payment = await getPaymentById(paymentId)
    if (!payment) {
      res.status(404).json({ message: 'Payment not found' })
      return
    }

    if (payment.PaymentStatus !== 'PENDING') {
      res.status(400).json({ message: 'Only pending payments can be processed' })
      return
    }

    const ipAddr =
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      '127.0.0.1'

    const paymentUrl = createPaymentUrl({
      amount: payment.Amount,
      orderId: payment.PaymentId.toString(),
      orderInfo: `Thanh toan hoa don ${payment.PaymentId}`,
      ipAddr: typeof ipAddr === 'string' ? ipAddr : ipAddr[0],
      bankCode,
      locale
    })

    res.status(200).json({ success: true, paymentUrl })
  } catch (error: any) {
    console.error('Error in createVnpayUrlHandler:', error)
    res.status(500).json({ message: `Server error while creating VNPay URL: ${error.message}` })
  }
}


/**
 * Handle VNPay Return URL redirect (Client-side)
 */
export const vnpayReturnHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vnpParams = req.query as Record<string, string>
    const isValid = verifySecureHash(vnpParams)

    if (!isValid) {
      res.status(400).send('Invalid signature')
      return
    }

    const responseCode = vnpParams['vnp_ResponseCode']
    const paymentId = parseInt(vnpParams['vnp_TxnRef'])

    if (responseCode === '00') {
      // 1. Update Payment status to PAID
      const payment = await confirmPayment(paymentId)

      // 2. Sync MarketplaceOrder status if needed
      let mpOrderId: number | null = null
      if (payment.PaymentType === 'ASSET' && payment.AssetId) {
        try {
          const mpOrder = await findPendingMarketplaceOrder(payment.AssetId, payment.CompanyId)
          if (mpOrder) {
            await updateMarketplaceOrderStatus(mpOrder.MpOrderId, 'PAID')
            mpOrderId = mpOrder.MpOrderId
          }
        } catch (mpError) {
          console.error('Failed to sync MarketplaceOrder in vnpayReturnHandler:', mpError)
        }
      }

      // 3. Redirect to Frontend Success Page
      // We try to find the frontend URL from CORS_ORIGIN or default to localhost:3000
      const origin = process.env.CORS_ORIGIN || 'http://localhost:3000'
      const frontendUrl = origin.includes('3000') ? origin : 'http://localhost:3000'

      let redirectUrl = `${frontendUrl}/marketplace/order-success?orderId=${mpOrderId ?? ''}`
      if (payment.AssetId) {
        redirectUrl += `&productId=${payment.AssetId}`
      }

      res.redirect(redirectUrl)
    } else {
      const origin = process.env.CORS_ORIGIN || 'http://localhost:3000'
      const frontendUrl = origin.includes('3000') ? origin : 'http://localhost:3000'
      res.redirect(`${frontendUrl}/customer-dashboard?tab=purchases&error=vnpay_${responseCode}`)
    }
  } catch (error) {
    console.error('Error in vnpayReturnHandler:', error)
    res.status(500).send('Server error while processing VNPay return')
  }
}

/**
 * Handle VNPay IPN (Server-to-Server callback)
 */
export const vnpayIpnHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vnpParams = req.query as Record<string, string>
    const isValid = verifySecureHash(vnpParams)

    if (!isValid) {
      res.status(200).json({ RspCode: '97', Message: 'Invalid signature' })
      return
    }

    const paymentId = parseInt(vnpParams['vnp_TxnRef'])
    const vnp_Amount = parseInt(vnpParams['vnp_Amount']) / 100
    const responseCode = vnpParams['vnp_ResponseCode']

    const payment = await getPaymentById(paymentId)
    if (!payment) {
      res.status(200).json({ RspCode: '01', Message: 'Order not found' })
      return
    }

    if (payment.Amount !== vnp_Amount) {
      res.status(200).json({ RspCode: '04', Message: 'Invalid amount' })
      return
    }

    if (payment.PaymentStatus !== 'PENDING') {
      res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' })
      return
    }

    // Success
    if (responseCode === '00') {
      await updatePaymentStatus(paymentId, 'PAID')

      // If it's an asset purchase, update the MarketplaceOrder too
      if (payment.PaymentType === 'ASSET' && payment.AssetId) {
        try {
          const mpOrder = await findPendingMarketplaceOrder(payment.AssetId, payment.CompanyId)
          if (mpOrder) {
            await updateMarketplaceOrderStatus(mpOrder.MpOrderId, 'PAID')
          }
        } catch (mpError) {
          console.error('Failed to update MarketplaceOrder status:', mpError)
        }
      }
    } else {
      await updatePaymentStatus(paymentId, 'FAILED')
    }

    res.status(200).json({ RspCode: '00', Message: 'Success' })
  } catch (error) {
    console.error('Error in vnpayIpnHandler:', error)
    res.status(200).json({ RspCode: '99', Message: 'Unknown error' })
  }
}

export const paymentController = {
  create: createPaymentHandler,
  confirm: confirmPaymentHandler,
  getById: getPaymentDetailHandler,
  list: listPaymentsHandler,
  createVnpayUrl: createVnpayUrlHandler,
  vnpayReturn: vnpayReturnHandler,
  vnpayIpn: vnpayIpnHandler
}

export default paymentController
