import sql from 'mssql'
import { getDbPool } from '../config/database'

export type CreativeOrderStatus = 'NEW' | 'IN_PRODUCTION' | 'REVIEW' | 'COMPLETED' | 'DELIVERED' | 'CANCELLED'

export interface CreativeOrder {
  OrderId: number
  CompanyId: number
  ProductId: number | null
  PackageId: number | null
  ProjectName: string | null
  ProductType: string | null
  Brief: string | null
  Budget: string | null
  DeliverySpeed: string | null
  TargetPlatform: string | null
  ArOptimize: boolean
  Animation: boolean
  MultiVariant: boolean
  SourceFiles: boolean
  Status: CreativeOrderStatus
  Deadline: Date | null
  CreatedAt: Date
  UpdatedAt: Date | null
  IsDeleted: boolean
}

export interface CreativeOrderDetail extends CreativeOrder {
  CompanyName: string | null
  ProductName: string | null
  PackageName: string | null
}

export interface CreateOrderInput {
  CompanyId?: number
  ProductId?: number | null
  PackageId?: number | null
  ProjectName?: string | null
  ProductType?: string | null
  Brief?: string | null
  Budget?: string | null
  DeliverySpeed?: string | null
  TargetPlatform?: string | null
  ArOptimize?: boolean
  Animation?: boolean
  MultiVariant?: boolean
  SourceFiles?: boolean
  Deadline?: Date | null
  Attachments?: { FileName: string; MimeType: string; Base64Data: string }[]
}

const getUserCompanyId = async (userId: number): Promise<number | null> => {
  const pool = await getDbPool()

  const result = await pool.request().input('UserId', sql.Int, userId).query(`
    SELECT CompanyId
    FROM [User]
    WHERE UserId = @UserId AND IsDeleted = 0
  `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0].CompanyId ?? null
}

export const createOrder = async (
  userId: number,
  roleName: string,
  payload: CreateOrderInput
): Promise<CreativeOrder> => {
  const normalizedRole = roleName.toUpperCase()
  const userCompanyId = await getUserCompanyId(userId)

  // Customers must always create orders for their own company.
  const companyId = normalizedRole === 'CUSTOMER' ? userCompanyId : payload.CompanyId ?? userCompanyId

  if (!companyId) {
    throw new Error('USER_COMPANY_NOT_FOUND')
  }

  const pool = await getDbPool()
  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  try {
    const request = new sql.Request(transaction)
    const result = await request
      .input('CompanyId', sql.Int, companyId)
      .input('ProductId', sql.Int, payload.ProductId ?? null)
      .input('PackageId', sql.Int, payload.PackageId ?? null)
      .input('ProjectName', sql.NVarChar(200), payload.ProjectName ?? null)
      .input('ProductType', sql.NVarChar(100), payload.ProductType ?? null)
      .input('Brief', sql.NVarChar(sql.MAX), payload.Brief ?? null)
      .input('Budget', sql.NVarChar(50), payload.Budget ?? null)
      .input('DeliverySpeed', sql.NVarChar(50), payload.DeliverySpeed ?? null)
      .input('TargetPlatform', sql.NVarChar(200), payload.TargetPlatform ?? null)
      .input('ArOptimize', sql.Bit, payload.ArOptimize ? 1 : 0)
      .input('Animation', sql.Bit, payload.Animation ? 1 : 0)
      .input('MultiVariant', sql.Bit, payload.MultiVariant ? 1 : 0)
      .input('SourceFiles', sql.Bit, payload.SourceFiles ? 1 : 0)
      .input('Status', sql.NVarChar(50), 'NEW')
      .input('Deadline', sql.DateTime, payload.Deadline ?? null)
      .query(`
        INSERT INTO [CreativeOrder] (
          CompanyId, ProductId, PackageId, ProjectName, ProductType, Brief, Budget, DeliverySpeed, TargetPlatform, ArOptimize, Animation, MultiVariant, SourceFiles, Status, Deadline
        )
        OUTPUT INSERTED.*
        VALUES (
          @CompanyId, @ProductId, @PackageId, @ProjectName, @ProductType, @Brief, @Budget, @DeliverySpeed, @TargetPlatform, @ArOptimize, @Animation, @MultiVariant, @SourceFiles, @Status, @Deadline
        )
      `)

    const order = result.recordset[0]

    if (payload.Attachments && payload.Attachments.length > 0) {
      for (const att of payload.Attachments) {
        const attReq = new sql.Request(transaction)
        await attReq
          .input('OrderId', sql.Int, order.OrderId)
          .input('FileName', sql.NVarChar(200), att.FileName)
          .input('MimeType', sql.NVarChar(100), att.MimeType)
          .input('Base64Data', sql.VarChar(sql.MAX), att.Base64Data)
          .query('INSERT INTO OrderAttachment (OrderId, FileName, MimeType, Base64Data) VALUES (@OrderId, @FileName, @MimeType, @Base64Data)')
      }
    }

    await transaction.commit()
    return order
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

export const getOrderDetailById = async (orderId: number): Promise<CreativeOrderDetail | null> => {
  const pool = await getDbPool()

  const result = await pool.request().input('OrderId', sql.Int, orderId).query(`
    SELECT
      o.*,
      c.CompanyName,
      p.ProductName,
      sp.PackageName
    FROM [CreativeOrder] o
    LEFT JOIN [Company] c ON o.CompanyId = c.CompanyId
    LEFT JOIN [Product] p ON o.ProductId = p.ProductId
    LEFT JOIN [ServicePackage] sp ON o.PackageId = sp.PackageId
    WHERE o.OrderId = @OrderId AND o.IsDeleted = 0
  `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0]
}

export const getOrderDetailForUser = async (
  orderId: number,
  userId: number,
  roleName: string
): Promise<CreativeOrderDetail | null> => {
  const order = await getOrderDetailById(orderId)

  if (!order) {
    return null
  }

  const normalizedRole = roleName.toUpperCase()
  if (normalizedRole === 'ADMIN' || normalizedRole === 'MANAGER') {
    return order
  }

  const companyId = await getUserCompanyId(userId)

  if (!companyId) {
    throw new Error('USER_COMPANY_NOT_FOUND')
  }

  if (order.CompanyId !== companyId) {
    throw new Error('ORDER_FORBIDDEN')
  }

  return order
}

export const listOrdersForArtist = async (userId: number): Promise<CreativeOrderDetail[]> => {
  const pool = await getDbPool()
  // Lấy orders có ProductionStage assign cho artist này
  const assignedResult = await pool.request().input('UserId', sql.Int, userId).query(`
    SELECT DISTINCT
      o.OrderId, o.CompanyId, o.ProductId, o.PackageId, o.Brief, o.TargetPlatform,
      o.Status, o.Deadline, o.CreatedAt, o.UpdatedAt, o.IsDeleted,
      c.CompanyName, p.ProductName, sp.PackageName
    FROM [CreativeOrder] o
    INNER JOIN [ProductionStage] ps ON o.OrderId = ps.OrderId AND ps.AssignedTo = @UserId
    LEFT JOIN [Company] c      ON o.CompanyId = c.CompanyId
    LEFT JOIN [Product] p      ON o.ProductId = p.ProductId
    LEFT JOIN [ServicePackage] sp ON o.PackageId = sp.PackageId
    WHERE o.IsDeleted = 0
    ORDER BY o.CreatedAt DESC
  `)
 
  if (assignedResult.recordset.length > 0) {
    return assignedResult.recordset
  }
 
  const fallbackResult = await pool.request().query(`
    SELECT
      o.OrderId, o.CompanyId, o.ProductId, o.PackageId, o.Brief, o.TargetPlatform,
      o.Status, o.Deadline, o.CreatedAt, o.UpdatedAt, o.IsDeleted,
      c.CompanyName, p.ProductName, sp.PackageName
    FROM [CreativeOrder] o
    LEFT JOIN [Company] c      ON o.CompanyId = c.CompanyId
    LEFT JOIN [Product] p      ON o.ProductId = p.ProductId
    LEFT JOIN [ServicePackage] sp ON o.PackageId = sp.PackageId
    WHERE o.IsDeleted = 0
      AND o.Status NOT IN ('COMPLETED', 'DELIVERED', 'CANCELLED')
    ORDER BY o.CreatedAt DESC
  `)
 
  return fallbackResult.recordset
}

export const listMyOrders = async (userId: number): Promise<CreativeOrderDetail[]> => {
  const companyId = await getUserCompanyId(userId)

  if (!companyId) {
    throw new Error('USER_COMPANY_NOT_FOUND')
  }

  const pool = await getDbPool()

  const result = await pool.request().input('CompanyId', sql.Int, companyId).query(`
    SELECT
      o.*,
      c.CompanyName,
      p.ProductName,
      sp.PackageName
    FROM [CreativeOrder] o
    LEFT JOIN [Company] c ON o.CompanyId = c.CompanyId
    LEFT JOIN [Product] p ON o.ProductId = p.ProductId
    LEFT JOIN [ServicePackage] sp ON o.PackageId = sp.PackageId
    WHERE o.CompanyId = @CompanyId AND o.IsDeleted = 0
    ORDER BY o.CreatedAt DESC
  `)

  return result.recordset
}

export const listOrdersForManager = async (): Promise<CreativeOrderDetail[]> => {
  const pool = await getDbPool()

  const result = await pool.request().query(`
    SELECT
      o.*,
      c.CompanyName,
      p.ProductName,
      sp.PackageName
    FROM [CreativeOrder] o
    LEFT JOIN [Company] c ON o.CompanyId = c.CompanyId
    LEFT JOIN [Product] p ON o.ProductId = p.ProductId
    LEFT JOIN [ServicePackage] sp ON o.PackageId = sp.PackageId
    WHERE o.IsDeleted = 0
    ORDER BY o.CreatedAt DESC
  `)

  return result.recordset
}

export const updateOrderStatus = async (orderId: number, status: CreativeOrderStatus): Promise<CreativeOrder> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('OrderId', sql.Int, orderId)
    .input('Status', sql.NVarChar(50), status)
    .input('UpdatedAt', sql.DateTime, new Date())
    .query(`
      UPDATE [CreativeOrder]
      SET Status = @Status, UpdatedAt = @UpdatedAt
      OUTPUT INSERTED.*
      WHERE OrderId = @OrderId AND IsDeleted = 0
    `)

  if (result.recordset.length === 0) {
    throw new Error('ORDER_NOT_FOUND')
  }

  return result.recordset[0]
}

export const cancelOrderForCustomer = async (orderId: number, userId: number): Promise<CreativeOrder> => {
  const companyId = await getUserCompanyId(userId)

  if (!companyId) {
    throw new Error('USER_COMPANY_NOT_FOUND')
  }

  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('OrderId', sql.Int, orderId)
    .input('CompanyId', sql.Int, companyId)
    .input('Status', sql.NVarChar(50), 'CANCELLED')
    .input('UpdatedAt', sql.DateTime, new Date())
    .query(`
      UPDATE [CreativeOrder]
      SET Status = @Status, UpdatedAt = @UpdatedAt
      OUTPUT INSERTED.*
      WHERE OrderId = @OrderId AND CompanyId = @CompanyId AND IsDeleted = 0 AND Status <> @Status
    `)

  if (result.recordset.length > 0) {
    return result.recordset[0]
  }

  const existingOrder = await pool.request().input('OrderId', sql.Int, orderId).query(`
    SELECT OrderId, CompanyId, Status
    FROM [CreativeOrder]
    WHERE OrderId = @OrderId AND IsDeleted = 0
  `)

  if (existingOrder.recordset.length === 0) {
    throw new Error('ORDER_NOT_FOUND')
  }

  const order = existingOrder.recordset[0] as { CompanyId: number; Status: CreativeOrderStatus }

  if (order.CompanyId !== companyId) {
    throw new Error('ORDER_FORBIDDEN')
  }

  if (order.Status === 'CANCELLED') {
    throw new Error('ORDER_ALREADY_CANCELLED')
  }

  throw new Error('ORDER_CANCEL_FAILED')
}
