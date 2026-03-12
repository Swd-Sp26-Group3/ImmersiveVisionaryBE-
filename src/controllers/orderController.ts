import type { Response } from 'express'
import type { AuthRequest } from '../middlewares/authMiddleware'
import {
  createOrder,
  getOrderDetailForUser,
  listMyOrders,
  listOrdersForManager,
  updateOrderStatus,
  cancelOrderForCustomer,
  type CreativeOrderStatus
} from '../services/orderService'

const ALLOWED_ORDER_STATUSES: CreativeOrderStatus[] = [
  'NEW',
  'IN_PRODUCTION',
  'REVIEW',
  'COMPLETED',
  'DELIVERED',
  'CANCELLED'
]

const parseOrderId = (idParam: string): number | null => {
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

const parseOptionalString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    return undefined
  }

  return value
}

const parseOptionalDate = (value: unknown): Date | null | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'string' && !(value instanceof Date)) {
    return undefined
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return undefined
  }

  return parsedDate
}

export const createOrderHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const { CompanyId, ProductId, PackageId, Brief, TargetPlatform, Deadline } = req.body

    if (CompanyId !== undefined && (!Number.isInteger(CompanyId) || CompanyId <= 0)) {
      res.status(400).json({ message: 'CompanyId must be a positive integer' })
      return
    }

    if (!Number.isInteger(ProductId) || ProductId <= 0) {
      res.status(400).json({ message: 'ProductId is required and must be a positive integer' })
      return
    }

    if (!Number.isInteger(PackageId) || PackageId <= 0) {
      res.status(400).json({ message: 'PackageId is required and must be a positive integer' })
      return
    }

    const parsedBrief = parseOptionalString(Brief)
    if (Brief !== undefined && parsedBrief === undefined) {
      res.status(400).json({ message: 'Brief must be a string or null' })
      return
    }

    const parsedTargetPlatform = parseOptionalString(TargetPlatform)
    if (TargetPlatform !== undefined && parsedTargetPlatform === undefined) {
      res.status(400).json({ message: 'TargetPlatform must be a string or null' })
      return
    }

    const parsedDeadline = parseOptionalDate(Deadline)
    if (Deadline !== undefined && parsedDeadline === undefined) {
      res.status(400).json({ message: 'Deadline must be a valid date string or null' })
      return
    }

    const order = await createOrder(req.user.userId, req.user.roleName, {
      CompanyId,
      ProductId,
      PackageId,
      Brief: parsedBrief,
      TargetPlatform: parsedTargetPlatform,
      Deadline: parsedDeadline
    })

    res.status(201).json({
      message: 'Create order successfully',
      data: order
    })
  } catch (error: any) {
    console.error('Error in createOrderHandler:', error)

    if (error.message === 'USER_COMPANY_NOT_FOUND') {
      res.status(400).json({ message: 'User is not associated with any company' })
      return
    }

    if (error?.number === 547) {
      res.status(400).json({ message: 'ProductId or PackageId does not exist' })
      return
    }

    res.status(500).json({ message: 'Server error while creating order' })
  }
}

export const getOrderDetailHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const orderId = parseOrderId(req.params.id)
    if (!orderId) {
      res.status(400).json({ message: 'Order ID is invalid' })
      return
    }

    const order = await getOrderDetailForUser(orderId, req.user.userId, req.user.roleName)

    if (!order) {
      res.status(404).json({ message: 'Order not found' })
      return
    }

    res.status(200).json({
      message: 'Get order detail successfully',
      data: order
    })
  } catch (error: any) {
    console.error('Error in getOrderDetailHandler:', error)

    if (error.message === 'USER_COMPANY_NOT_FOUND') {
      res.status(400).json({ message: 'User is not associated with any company' })
      return
    }

    if (error.message === 'ORDER_FORBIDDEN') {
      res.status(403).json({ message: 'You are not allowed to access this order' })
      return
    }

    res.status(500).json({ message: 'Server error while getting order detail' })
  }
}

export const listMyOrdersHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const orders = await listMyOrders(req.user.userId)

    res.status(200).json({
      message: 'Get my orders successfully',
      data: orders
    })
  } catch (error: any) {
    console.error('Error in listMyOrdersHandler:', error)

    if (error.message === 'USER_COMPANY_NOT_FOUND') {
      res.status(400).json({ message: 'User is not associated with any company' })
      return
    }

    res.status(500).json({ message: 'Server error while getting my orders' })
  }
}

export const listOrdersHandler = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await listOrdersForManager()

    res.status(200).json({
      message: 'Get orders successfully',
      data: orders
    })
  } catch (error) {
    console.error('Error in listOrdersHandler:', error)
    res.status(500).json({ message: 'Server error while getting orders' })
  }
}

export const updateOrderStatusHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderId = parseOrderId(req.params.id)
    if (!orderId) {
      res.status(400).json({ message: 'Order ID is invalid' })
      return
    }

    const { Status } = req.body

    if (typeof Status !== 'string' || !ALLOWED_ORDER_STATUSES.includes(Status as CreativeOrderStatus)) {
      res.status(400).json({
        message: `Status must be one of: ${ALLOWED_ORDER_STATUSES.join(', ')}`
      })
      return
    }

    const order = await updateOrderStatus(orderId, Status as CreativeOrderStatus)

    res.status(200).json({
      message: 'Update order status successfully',
      data: order
    })
  } catch (error: any) {
    console.error('Error in updateOrderStatusHandler:', error)

    if (error.message === 'ORDER_NOT_FOUND') {
      res.status(404).json({ message: 'Order not found' })
      return
    }

    res.status(500).json({ message: 'Server error while updating order status' })
  }
}

export const cancelOrderHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const orderId = parseOrderId(req.params.id)
    if (!orderId) {
      res.status(400).json({ message: 'Order ID is invalid' })
      return
    }

    const order = await cancelOrderForCustomer(orderId, req.user.userId)

    res.status(200).json({
      message: 'Cancel order successfully',
      data: order
    })
  } catch (error: any) {
    console.error('Error in cancelOrderHandler:', error)

    if (error.message === 'USER_COMPANY_NOT_FOUND') {
      res.status(400).json({ message: 'User is not associated with any company' })
      return
    }

    if (error.message === 'ORDER_NOT_FOUND') {
      res.status(404).json({ message: 'Order not found' })
      return
    }

    if (error.message === 'ORDER_FORBIDDEN') {
      res.status(403).json({ message: 'You are not allowed to cancel this order' })
      return
    }

    if (error.message === 'ORDER_ALREADY_CANCELLED') {
      res.status(400).json({ message: 'Order is already cancelled' })
      return
    }

    res.status(500).json({ message: 'Server error while cancelling order' })
  }
}

export const orderController = {
  create: createOrderHandler,
  getById: getOrderDetailHandler,
  listMy: listMyOrdersHandler,
  list: listOrdersHandler,
  updateStatus: updateOrderStatusHandler,
  cancel: cancelOrderHandler
}

export default orderController
