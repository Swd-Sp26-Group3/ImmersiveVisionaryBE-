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
  let companyId = normalizedRole === 'CUSTOMER' ? userCompanyId : payload.CompanyId ?? userCompanyId

  const pool = await getDbPool()
  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  try {
    if (!companyId) {
      if (normalizedRole === 'CUSTOMER') {
        // Auto-create a Personal Account company for the customer
        const createCompanyReq = new sql.Request(transaction)
        const companyRes = await createCompanyReq
          .input('CompanyName', sql.NVarChar(200), 'Personal Account')
          .input('CompanyType', sql.NVarChar(50), 'BRAND')
          .query(`
            INSERT INTO [Company] (CompanyName, CompanyType, Status)
            OUTPUT INSERTED.CompanyId
            VALUES (@CompanyName, @CompanyType, 'ACTIVE')
          `)

        companyId = companyRes.recordset[0].CompanyId

        // Link company to user
        const updateUserReq = new sql.Request(transaction)
        await updateUserReq
          .input('CompanyId', sql.Int, companyId)
          .input('UserId', sql.Int, userId)
          .query('UPDATE [User] SET CompanyId = @CompanyId WHERE UserId = @UserId')
      } else {
        throw new Error('USER_COMPANY_NOT_FOUND')
      }
    }
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

export const updateOrderStatus = async (
  orderId: number,
  status: CreativeOrderStatus,
  artistId?: number,
  brief?: string
): Promise<CreativeOrder> => {
  const pool = await getDbPool()
  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  try {
    const request = new sql.Request(transaction)
    const result = await request
      .input('OrderId', sql.Int, orderId)
      .input('Status', sql.NVarChar(50), status)
      .input('Brief', sql.NVarChar(sql.MAX), brief ?? null)
      .input('UpdatedAt', sql.DateTime, new Date())
      .query(`
        UPDATE [CreativeOrder]
        SET Status = @Status, 
            UpdatedAt = @UpdatedAt
            ${brief !== undefined ? ', Brief = @Brief' : ''}
        OUTPUT INSERTED.*
        WHERE OrderId = @OrderId AND IsDeleted = 0
      `)

    if (result.recordset.length === 0) {
      throw new Error('ORDER_NOT_FOUND')
    }

    const order = result.recordset[0]

    // Automation: If status is DELIVERED (Approved by customer), create a MarketplaceOrder (Purchase) record
    // so it shows up in the customer's Purchases tab.
    if (status === 'DELIVERED') {
      try {
        // 1. Get final .obj attachment
        const attRes = await request.input('CompOrderId', sql.Int, orderId).query(`
          SELECT TOP 1 FileName, Base64Data 
          FROM OrderAttachment 
          WHERE OrderId = @CompOrderId AND FileName LIKE '%.obj'
          ORDER BY CreatedAt DESC
        `)
        const finalAtt = attRes.recordset[0]

        if (finalAtt) {
          // 2. Extract price from Budget (e.g. "5000000 VND" -> 5000000)
          const budgetStr = order.Budget || "0"
          const numericPrice = parseFloat(budgetStr.replace(/[^0-9.]/g, '')) || 0

          // 3. Get Seller (Artist) from ProductionStage
          const psRes = await request.query(`
            SELECT TOP 1 AssignedTo FROM ProductionStage WHERE OrderId = @CompOrderId
          `)
          const sellerId = psRes.recordset[0]?.AssignedTo

          if (sellerId) {
            // 4. Create Asset3D for this delivery
            const assetRes = await request
              .input('AssetName', sql.NVarChar(200), order.ProjectName || `Result for #${orderId}`)
              .input('AssetOwnerId', sql.Int, order.CompanyId)
              .input('CreatedByArtist', sql.Int, sellerId)
              .input('AssetPrice', sql.Decimal(18, 2), numericPrice)
              .input('AssetBase64', sql.VarChar(sql.MAX), finalAtt.Base64Data)
              .query(`
                INSERT INTO [Asset3D] (OrderId, AssetName, OwnerCompanyId, CreatedBy, AssetType, Price, Base64Data, PublishStatus, IsMarketplace)
                OUTPUT INSERTED.AssetId
                VALUES (@CompOrderId, @AssetName, @AssetOwnerId, @CreatedByArtist, 'ORDER', @AssetPrice, @AssetBase64, 'PUBLISHED', 0)
              `)
            const newAssetId = assetRes.recordset[0].AssetId

            // 5. Create MarketplaceOrder (INTERNAL)
            // Get SellerCompanyId for the artist
            const sellerCompRes = await request.input('ArtistUserId', sql.Int, sellerId).query(`
              SELECT CompanyId FROM [User] WHERE UserId = @ArtistUserId
            `)
            const sellerCompanyId = sellerCompRes.recordset[0]?.CompanyId || 1 // Fallback to system company

            await request
              .input('MpAssetId', sql.Int, newAssetId)
              .input('MpBuyerCompanyId', sql.Int, order.CompanyId)
              .input('MpSellerCompanyId', sql.Int, sellerCompanyId)
              .input('MpPrice', sql.Decimal(18, 2), numericPrice)
              .query(`
                INSERT INTO [MarketplaceOrder] (AssetId, BuyerCompanyId, SellerCompanyId, Price, Status)
                VALUES (@MpAssetId, @MpBuyerCompanyId, @MpSellerCompanyId, @MpPrice, 'PENDING')
              `)
          }
        }
      } catch (err) {
        console.error('Order-to-Purchase Automation Warning:', err)
        // We don't fail the whole status update if automation fails, but we log it.
      }
    }

    // Nếu status là IN_PRODUCTION và có artistId, tạo ProductionStage
    if (status === 'IN_PRODUCTION' && artistId) {
      const stageReq = new sql.Request(transaction)
      await stageReq
        .input('OrderId', sql.Int, orderId)
        .input('StageName', sql.NVarChar(50), 'MODELING')
        .input('StageOrder', sql.Int, 1)
        .input('AssignedTo', sql.Int, artistId)
        .input('Status', sql.NVarChar(50), 'IN_PROGRESS')
        .query(`
          IF NOT EXISTS (SELECT 1 FROM ProductionStage WHERE OrderId = @OrderId)
          BEGIN
            INSERT INTO ProductionStage (OrderId, StageName, StageOrder, AssignedTo, Status, StartDate)
            VALUES (@OrderId, @StageName, @StageOrder, @AssignedTo, @Status, GETDATE())
          END
          ELSE
          BEGIN
            UPDATE ProductionStage 
            SET AssignedTo = @AssignedTo, Status = @Status
            WHERE OrderId = @OrderId
          END
        `)
    }

    await transaction.commit()
    return order
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}


export const updateOrder = async (
  orderId: number,
  updates: Partial<Pick<CreativeOrder, 'ProjectName' | 'ProductType' | 'Brief' | 'Budget' | 'DeliverySpeed' | 'TargetPlatform' | 'Deadline'>>
): Promise<CreativeOrder> => {
  const pool = await getDbPool()
  const updatedAt = new Date()

  let updateFields = ''
  const request = pool.request()
  request.input('OrderId', sql.Int, orderId)
  request.input('UpdatedAt', sql.DateTime, updatedAt)

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      updateFields += `, ${key} = @${key}`
      if (key === 'Deadline' && value !== null) {
        request.input(key, sql.DateTime, value)
      } else {
        request.input(key, sql.NVarChar, value)
      }
    }
  })

  if (!updateFields) {
    throw new Error('No fields provided for update')
  }

  const result = await request.query(`
    UPDATE [CreativeOrder]
    SET UpdatedAt = @UpdatedAt
        ${updateFields}
    OUTPUT INSERTED.*
    WHERE OrderId = @OrderId AND IsDeleted = 0
  `)

  if (result.recordset.length === 0) {
    throw new Error('Order not found or update failed')
  }

  const updatedOrder = result.recordset[0]

  // IF Budget was updated, we need to sync it to Asset3D and MarketplaceOrder (if they exist)
  if (updates.Budget !== undefined) {
    try {
      const budgetStr = updates.Budget || "0"
      const numericPrice = parseFloat(budgetStr.replace(/[^0-9.]/g, '')) || 0

      // Update Asset3D price
      const assetRes = await pool.request()
        .input('OrderId', sql.Int, orderId)
        .input('NewPrice', sql.Decimal(18, 2), numericPrice)
        .query(`
          UPDATE [Asset3D]
          SET Price = @NewPrice
          OUTPUT INSERTED.AssetId
          WHERE OrderId = @OrderId
        `)

      if (assetRes.recordset.length > 0) {
        const assetId = assetRes.recordset[0].AssetId
        // Update MarketplaceOrder price
        await pool.request()
          .input('AssetId', sql.Int, assetId)
          .input('NewPrice', sql.Decimal(18, 2), numericPrice)
          .query(`
            UPDATE [MarketplaceOrder]
            SET Price = @NewPrice
            WHERE AssetId = @AssetId AND Status = 'PENDING'
          `)
      }
    } catch (err) {
      console.error('Price Sync Warning:', err)
      // Non-blocking but we log it
    }
  }

  return updatedOrder
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
export const getAttachmentsForOrder = async (orderId: number): Promise<any[]> => {
  const pool = await getDbPool()
  const result = await pool.request()
    .input('OrderId', sql.Int, orderId)
    .query('SELECT * FROM OrderAttachment WHERE OrderId = @OrderId ORDER BY CreatedAt DESC')
  return result.recordset
}

export const addAttachmentToOrder = async (orderId: number, attachment: { FileName: string; MimeType: string; Base64Data: string }): Promise<any> => {
  const pool = await getDbPool()
  const result = await pool.request()
    .input('OrderId', sql.Int, orderId)
    .input('FileName', sql.NVarChar(200), attachment.FileName)
    .input('MimeType', sql.NVarChar(100), attachment.MimeType)
    .input('Base64Data', sql.VarChar(sql.MAX), attachment.Base64Data)
    .query(`
      INSERT INTO OrderAttachment (OrderId, FileName, MimeType, Base64Data)
      OUTPUT INSERTED.*
      VALUES (@OrderId, @FileName, @MimeType, @Base64Data)
    `)
  return result.recordset[0]
}

export const deleteAttachment = async (attachmentId: number): Promise<void> => {
  const pool = await getDbPool()
  const result = await pool.request()
    .input('AttachmentId', sql.Int, attachmentId)
    .query('DELETE FROM OrderAttachment WHERE AttachmentId = @AttachmentId')

  if (result.rowsAffected[0] === 0) {
    throw new Error('ATTACHMENT_NOT_FOUND')
  }
}
