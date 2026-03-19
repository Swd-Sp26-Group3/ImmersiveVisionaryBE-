import type { Response } from 'express'
import type { AuthRequest } from '../middlewares/authMiddleware'
import {
  createOrder,
  getOrderDetailForUser,
  listMyOrders,
  listOrdersForArtist,
  listOrdersForManager,
  updateOrderStatus,
  updateOrder,
  cancelOrderForCustomer,
  getAttachmentsForOrder,
  addAttachmentToOrder,
  deleteAttachment,
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

    const {
      CompanyId,
      ProductId,
      PackageId,
      ProjectName,
      ProductType,
      Brief,
      Budget,
      DeliverySpeed,
      TargetPlatform,
      ArOptimize,
      Animation,
      MultiVariant,
      SourceFiles,
      Deadline,
      Attachments
    } = req.body

    if (CompanyId !== undefined && (!Number.isInteger(CompanyId) || CompanyId <= 0)) {
      res.status(400).json({ message: 'CompanyId must be a positive integer' })
      return
    }

    if (ProductId !== undefined && ProductId !== null && (!Number.isInteger(ProductId) || ProductId <= 0)) {
      res.status(400).json({ message: 'ProductId must be a positive integer' })
      return
    }

    if (PackageId !== undefined && PackageId !== null && (!Number.isInteger(PackageId) || PackageId <= 0)) {
      res.status(400).json({ message: 'PackageId must be a positive integer' })
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

    const parsedProjectName = parseOptionalString(ProjectName)
    const parsedProductType = parseOptionalString(ProductType)
    const parsedBudget = parseOptionalString(Budget)
    const parsedDeliverySpeed = parseOptionalString(DeliverySpeed)

    const order = await createOrder(req.user.userId, req.user.roleName, {
      CompanyId,
      ProductId: ProductId ?? null,
      PackageId: PackageId ?? null,
      ProjectName: parsedProjectName,
      ProductType: parsedProductType,
      Brief: parsedBrief,
      Budget: parsedBudget,
      DeliverySpeed: parsedDeliverySpeed,
      TargetPlatform: parsedTargetPlatform,
      ArOptimize: Boolean(ArOptimize),
      Animation: Boolean(Animation),
      MultiVariant: Boolean(MultiVariant),
      SourceFiles: Boolean(SourceFiles),
      Deadline: parsedDeadline,
      Attachments: Array.isArray(Attachments) ? Attachments : []
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
    if (!req.user) { res.status(401).json({ message: 'Unauthorized' }); return }

    const normalizedRole = req.user.roleName?.toUpperCase()

    const orders = normalizedRole === 'ARTIST'
      ? await listOrdersForArtist(req.user.userId)
      : await listMyOrders(req.user.userId)

    res.status(200).json({ message: 'Get my orders successfully', data: orders })
  } catch (error: any) {
    console.error('Error in listMyOrdersHandler:', error)
    if (error.message === 'USER_COMPANY_NOT_FOUND') {
      res.status(400).json({ message: 'User is not associated with any company' }); return
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

    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    // Security check for CUSTOMER role
    if (req.user.roleName?.toUpperCase() === 'CUSTOMER') {
      const order = await getOrderDetailForUser(orderId, req.user.userId, req.user.roleName)
      if (!order) {
        res.status(403).json({ message: 'You are not allowed to update this order' })
        return
      }
    }

    const { Status, ArtistId, Brief } = req.body

    if (typeof Status !== 'string' || !ALLOWED_ORDER_STATUSES.includes(Status as CreativeOrderStatus)) {
      res.status(400).json({
        message: `Status must be one of: ${ALLOWED_ORDER_STATUSES.join(', ')}`
      })
      return
    }

    if (ArtistId !== undefined && ArtistId !== null && (!Number.isInteger(ArtistId) || ArtistId <= 0)) {
      res.status(400).json({ message: 'ArtistId must be a positive integer' })
      return
    }

    const order = await updateOrderStatus(orderId, Status as CreativeOrderStatus, ArtistId ?? undefined, Brief)

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

export const updateOrderHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderId = parseOrderId(req.params.id)
    if (!orderId) {
      res.status(400).json({ message: 'Order ID is invalid' })
      return
    }

    const {
      ProjectName,
      ProductType,
      Brief,
      Budget,
      DeliverySpeed,
      TargetPlatform,
      Deadline
    } = req.body

    const updates: any = {}
    if (ProjectName !== undefined) updates.ProjectName = parseOptionalString(ProjectName)
    if (ProductType !== undefined) updates.ProductType = parseOptionalString(ProductType)
    if (Brief !== undefined) updates.Brief = parseOptionalString(Brief)
    if (Budget !== undefined) updates.Budget = parseOptionalString(Budget)
    if (DeliverySpeed !== undefined) updates.DeliverySpeed = parseOptionalString(DeliverySpeed)
    if (TargetPlatform !== undefined) updates.TargetPlatform = parseOptionalString(TargetPlatform)
    if (Deadline !== undefined) updates.Deadline = parseOptionalDate(Deadline)

    const order = await updateOrder(orderId, updates)

    res.status(200).json({
      message: 'Update order successfully',
      data: order
    })
  } catch (error: any) {
    console.error('Error in updateOrderHandler:', error)
    res.status(500).json({ message: 'Server error while updating order' })
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

export const getAttachmentsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderId = parseOrderId(req.params.id)
    if (!orderId) { res.status(400).json({ message: 'Order ID is invalid' }); return }
    const attachments = await getAttachmentsForOrder(orderId)
    res.status(200).json({ message: 'Get attachments successfully', data: attachments })
  } catch (error) {
    console.error('Error in getAttachmentsHandler:', error)
    res.status(500).json({ message: 'Server error while getting attachments' })
  }
}

export const addAttachmentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderId = parseOrderId(req.params.id)
    if (!orderId) { res.status(400).json({ message: 'Order ID is invalid' }); return }
    const { FileName, MimeType, Base64Data } = req.body
    if (!FileName || !Base64Data) { res.status(400).json({ message: 'FileName and Base64Data are required' }); return }
    const attachment = await addAttachmentToOrder(orderId, { FileName, MimeType, Base64Data })
    res.status(201).json({ message: 'Add attachment successfully', data: attachment })
  } catch (error) {
    console.error('Error in addAttachmentHandler:', error)
    res.status(500).json({ message: 'Server error while adding attachment' })
  }
}

export const deleteAttachmentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attachmentId = parseOrderId(req.params.id)
    if (!attachmentId) { res.status(400).json({ message: 'Attachment ID is invalid' }); return }
    await deleteAttachment(attachmentId)
    res.status(200).json({ message: 'Delete attachment successfully' })
  } catch (error: any) {
    console.error('Error in deleteAttachmentHandler:', error)
    if (error.message === 'ATTACHMENT_NOT_FOUND') { res.status(404).json({ message: 'Attachment not found' }); return }
    res.status(500).json({ message: 'Server error while deleting attachment' })
  }
}

export const orderController = {
  create: createOrderHandler,
  getById: getOrderDetailHandler,
  listMy: listMyOrdersHandler,
  list: listOrdersHandler,
  update: updateOrderHandler,
  updateStatus: updateOrderStatusHandler,
  cancel: cancelOrderHandler,
  getAttachments: getAttachmentsHandler,
  addAttachment: addAttachmentHandler,
  deleteAttachment: deleteAttachmentHandler
}

export default orderController
