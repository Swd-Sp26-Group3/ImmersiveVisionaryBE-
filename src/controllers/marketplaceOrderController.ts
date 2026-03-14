import type { Response } from 'express'
import type { AuthRequest } from '../middlewares/authMiddleware'
import {
  createMarketplaceOrder,
  getMarketplaceOrderDetail,
  listAllMarketplaceOrders,
  listMyPurchases,
  refundMarketplaceOrder
} from '../services/marketplaceOrderService'

const parseId = (idParam: string): number | null => {
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

export const createMarketplaceOrderHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const { AssetId, BuyerCompanyId } = req.body

    if (!Number.isInteger(AssetId) || AssetId <= 0) {
      res.status(400).json({ message: 'AssetId is required and must be a positive integer' })
      return
    }

    if (BuyerCompanyId !== undefined && BuyerCompanyId !== null && (!Number.isInteger(BuyerCompanyId) || BuyerCompanyId <= 0)) {
      res.status(400).json({ message: 'BuyerCompanyId must be a positive integer or null' })
      return
    }

    const order = await createMarketplaceOrder(req.user.userId, req.user.roleName, {
      AssetId,
      BuyerCompanyId: BuyerCompanyId ?? undefined
    })

    res.status(201).json({
      message: 'Create marketplace order successfully',
      data: order
    })
  } catch (error: any) {
    console.error('Error in createMarketplaceOrderHandler:', error)

    if (error.message === 'BUYER_COMPANY_NOT_FOUND') {
      res.status(400).json({ message: 'Buyer company not found' })
      return
    }

    if (error.message === 'ASSET_NOT_AVAILABLE') {
      res.status(400).json({ message: 'Asset is not available for marketplace order' })
      return
    }

    if (error.message === 'CANNOT_BUY_OWN_ASSET') {
      res.status(400).json({ message: 'Cannot buy your own asset' })
      return
    }

    if (error.message === 'ORDER_ALREADY_EXISTS') {
      res.status(400).json({ message: 'You already purchased this asset and it is not refunded yet' })
      return
    }

    res.status(500).json({ message: 'Server error while creating marketplace order' })
  }
}

export const listMyPurchasesHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const orders = await listMyPurchases(req.user.userId)

    res.status(200).json({
      message: 'Get my purchases successfully',
      data: orders
    })
  } catch (error: any) {
    console.error('Error in listMyPurchasesHandler:', error)

    if (error.message === 'BUYER_COMPANY_NOT_FOUND') {
      res.status(400).json({ message: 'Buyer company not found' })
      return
    }

    res.status(500).json({ message: 'Server error while getting my purchases' })
  }
}

export const listAllMarketplaceOrdersHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ message: 'Unauthorized' }); return }
    const orders = await listAllMarketplaceOrders()
    res.status(200).json({ message: 'Get all marketplace orders successfully', data: orders })
  } catch (error: any) {
    console.error('Error in listAllMarketplaceOrdersHandler:', error)
    res.status(500).json({ message: 'Server error while getting marketplace orders' })
  }
}

export const getMarketplaceOrderDetailHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const mpOrderId = parseId(req.params.id)
    if (!mpOrderId) {
      res.status(400).json({ message: 'Marketplace order ID is invalid' })
      return
    }

    const order = await getMarketplaceOrderDetail(req.user.userId, req.user.roleName, mpOrderId)

    if (!order) {
      res.status(404).json({ message: 'Marketplace order not found' })
      return
    }

    res.status(200).json({
      message: 'Get marketplace order detail successfully',
      data: order
    })
  } catch (error) {
    console.error('Error in getMarketplaceOrderDetailHandler:', error)
    res.status(500).json({ message: 'Server error while getting marketplace order detail' })
  }
}

export const refundMarketplaceOrderHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const mpOrderId = parseId(req.params.id)
    if (!mpOrderId) {
      res.status(400).json({ message: 'Marketplace order ID is invalid' })
      return
    }

    const order = await refundMarketplaceOrder(req.user.userId, req.user.roleName, mpOrderId)

    res.status(200).json({
      message: 'Refund marketplace order successfully',
      data: order
    })
  } catch (error: any) {
    console.error('Error in refundMarketplaceOrderHandler:', error)

    if (error.message === 'ORDER_NOT_FOUND') {
      res.status(404).json({ message: 'Marketplace order not found' })
      return
    }

    if (error.message === 'ORDER_CANNOT_REFUND') {
      res.status(400).json({ message: 'Only PAID or DELIVERED orders can be refunded' })
      return
    }

    res.status(500).json({ message: 'Server error while refunding marketplace order' })
  }
}

export const marketplaceOrderController = {
  create: createMarketplaceOrderHandler,
  listMy: listMyPurchasesHandler,
  listAll: listAllMarketplaceOrdersHandler,
  getById: getMarketplaceOrderDetailHandler,
  refund: refundMarketplaceOrderHandler
}

export default marketplaceOrderController
