import fs from 'fs'
import path from 'path'
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
  CreatedByUserId: number | null
  Deadline: Date | null
  CreatedAt: Date
  UpdatedAt: Date | null
  IsDeleted: boolean
}

export interface CreativeOrderDetail extends CreativeOrder {
  CompanyName: string | null
  ProductName: string | null
  PackageName: string | null
  BuyerName?: string | null
  BuyerPhone?: string | null
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
  CreatedByUserId?: number | null
  Deadline?: Date | null
  Attachments?: { FileName: string; MimeType: string; Base64Data: string }[]
}

export const parseBudgetToPrice = (budgetStr: string): number => {
  if (!budgetStr) return 0

  const str = budgetStr.toLowerCase().trim()

  const parseSingleValue = (valStr: string): number => {
    let s = valStr.replace(/\s+/g, '')
    
    if (s.includes('m') || s.includes('tr') || s.includes('trieu') || s.includes('triệu')) {
      const normalized = s.replace(/,/g, '.')
      const numPart = parseFloat(normalized.replace(/[^0-9.]/g, '')) || 0
      return numPart * 1000000
    }

    if (s.includes('k')) {
      const normalized = s.replace(/,/g, '.')
      const numPart = parseFloat(normalized.replace(/[^0-9.]/g, '')) || 0
      return numPart * 1000
    }

    const hasMultipleDotsOrCommas = (s.match(/[.,]/g) || []).length > 1
    if (hasMultipleDotsOrCommas) {
      s = s.replace(/[.,]/g, '')
    } else {
      const dotIdx = s.indexOf('.')
      const commaIdx = s.indexOf(',')
      const idx = dotIdx !== -1 ? dotIdx : commaIdx
      if (idx !== -1) {
        const after = s.slice(idx + 1)
        if (after.length === 3 && !isNaN(Number(after))) {
          s = s.replace(/[.,]/g, '')
        } else {
          s = s.replace(/,/g, '.')
        }
      }
    }

    const numPart = parseFloat(s.replace(/[^0-9.]/g, '')) || 0

    return numPart
  }

  const rangeSeparators = ['-', 'to', 'đến', '/']
  for (const sep of rangeSeparators) {
    if (str.includes(sep)) {
      const parts = str.split(sep)
      if (parts.length === 2) {
        const val1 = parseSingleValue(parts[0])
        const val2 = parseSingleValue(parts[1])
        return Math.max(val1, val2)
      }
    }
  }

  return parseSingleValue(str)
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
      .input('CreatedByUserId', sql.Int, userId)
      .input('Deadline', sql.DateTime, payload.Deadline ?? null)
      .query(`
        INSERT INTO [CreativeOrder] (
          CompanyId, ProductId, PackageId, ProjectName, ProductType, Brief, Budget, DeliverySpeed, TargetPlatform, ArOptimize, Animation, MultiVariant, SourceFiles, Status, CreatedByUserId, Deadline
        )
        OUTPUT INSERTED.*
        VALUES (
          @CompanyId, @ProductId, @PackageId, @ProjectName, @ProductType, @Brief, @Budget, @DeliverySpeed, @TargetPlatform, @ArOptimize, @Animation, @MultiVariant, @SourceFiles, @Status, @CreatedByUserId, @Deadline
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
        sp.PackageName,
        u.UserName as BuyerName,
        u.Phone as BuyerPhone
      FROM [CreativeOrder] o
      LEFT JOIN [Company] c ON o.CompanyId = c.CompanyId
      LEFT JOIN [Product] p ON o.ProductId = p.ProductId
      LEFT JOIN [ServicePackage] sp ON o.PackageId = sp.PackageId
      LEFT JOIN [User] u ON o.CreatedByUserId = u.UserId
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

  // If user has no company, allow access if they created the order
  if (!companyId) {
    if (order.CreatedByUserId === userId) {
      return order
    }
    throw new Error('ORDER_FORBIDDEN')
  }

  if (order.CompanyId !== companyId && order.CreatedByUserId !== userId) {
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
  const pool = await getDbPool()

  // If user has no company, list orders they personally created
  if (!companyId) {
    const result = await pool.request().input('UserId', sql.Int, userId).query(`
      SELECT
        o.*,
        c.CompanyName,
        p.ProductName,
        sp.PackageName,
        u.UserName as BuyerName,
        u.Phone as BuyerPhone
      FROM [CreativeOrder] o
      LEFT JOIN [Company] c ON o.CompanyId = c.CompanyId
      LEFT JOIN [Product] p ON o.ProductId = p.ProductId
      LEFT JOIN [ServicePackage] sp ON o.PackageId = sp.PackageId
      LEFT JOIN [User] u ON o.CreatedByUserId = u.UserId
      WHERE o.CreatedByUserId = @UserId AND o.IsDeleted = 0
      ORDER BY o.CreatedAt DESC
    `)
    return result.recordset
  }

  const result = await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('UserId', sql.Int, userId)
    .query(`
      SELECT
        o.*,
        c.CompanyName,
        p.ProductName,
        sp.PackageName,
        u.UserName as BuyerName,
        u.Phone as BuyerPhone
      FROM [CreativeOrder] o
      LEFT JOIN [Company] c ON o.CompanyId = c.CompanyId
      LEFT JOIN [Product] p ON o.ProductId = p.ProductId
      LEFT JOIN [ServicePackage] sp ON o.PackageId = sp.PackageId
      LEFT JOIN [User] u ON o.CreatedByUserId = u.UserId
      WHERE (o.CompanyId = @CompanyId OR o.CreatedByUserId = @UserId) AND o.IsDeleted = 0
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
        sp.PackageName,
        u.UserName as BuyerName
      FROM [CreativeOrder] o
      LEFT JOIN [Company] c ON o.CompanyId = c.CompanyId
      LEFT JOIN [Product] p ON o.ProductId = p.ProductId
      LEFT JOIN [ServicePackage] sp ON o.PackageId = sp.PackageId
      LEFT JOIN [User] u ON o.CreatedByUserId = u.UserId
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
        // 1. Get final attachment (prioritizing 3D/zip files)
        const attReq = new sql.Request(transaction)
        const attRes = await attReq.input('CompOrderId', sql.Int, orderId).query(`
          SELECT TOP 1 FileName, Base64Data 
          FROM OrderAttachment 
          WHERE OrderId = @CompOrderId
          ORDER BY 
            CASE 
              WHEN FileName LIKE '%.obj' OR FileName LIKE '%.glb' OR FileName LIKE '%.gltf' OR FileName LIKE '%.zip' OR FileName LIKE '%.blend' THEN 0
              ELSE 1
            END,
            CreatedAt DESC
        `)
        const finalAtt = attRes.recordset[0]
        const assetBase64 = finalAtt ? finalAtt.Base64Data : 'data:application/octet-stream;base64,cGxhY2Vob2xkZXI='

        // 2. Extract price from Budget (using smart parser)
        const budgetStr = order.Budget || "0"
        const numericPrice = parseBudgetToPrice(budgetStr)

        // 3. Get Seller (Artist) from ProductionStage
        const psReq = new sql.Request(transaction)
        const psRes = await psReq.input('CompOrderId', sql.Int, orderId).query(`
          SELECT TOP 1 AssignedTo FROM ProductionStage WHERE OrderId = @CompOrderId
        `)
        const sellerId = psRes.recordset[0]?.AssignedTo || 1

        // 4. Create Asset3D for this delivery
        const assetReq = new sql.Request(transaction)
        const assetRes = await assetReq
          .input('CompOrderId', sql.Int, orderId)
          .input('AssetName', sql.NVarChar(200), order.ProjectName || `Result for #${orderId}`)
          .input('AssetOwnerId', sql.Int, order.CompanyId)
          .input('CreatedByArtist', sql.Int, sellerId)
          .input('AssetPrice', sql.Decimal(18, 2), numericPrice)
          .input('AssetBase64', sql.VarChar(sql.MAX), assetBase64)
          .query(`
            INSERT INTO [Asset3D] (OrderId, AssetName, OwnerCompanyId, CreatedBy, AssetType, Price, Base64Data, PublishStatus, IsMarketplace)
            OUTPUT INSERTED.AssetId
            VALUES (@CompOrderId, @AssetName, @AssetOwnerId, @CreatedByArtist, 'ORDER', @AssetPrice, @AssetBase64, 'PUBLISHED', 0)
          `)
        const newAssetId = assetRes.recordset[0].AssetId

        // 5. Create MarketplaceOrder (INTERNAL)
        // Get SellerCompanyId for the artist
        const sellerCompReq = new sql.Request(transaction)
        const sellerCompRes = await sellerCompReq.input('ArtistUserId', sql.Int, sellerId).query(`
          SELECT CompanyId FROM [User] WHERE UserId = @ArtistUserId
        `)
        const sellerCompanyId = sellerCompRes.recordset[0]?.CompanyId || 1 // Fallback to system company

        const mpOrderReq = new sql.Request(transaction)
        await mpOrderReq
          .input('MpAssetId', sql.Int, newAssetId)
          .input('MpBuyerCompanyId', sql.Int, order.CompanyId)
          .input('MpBuyerUserId', sql.Int, order.CreatedByUserId)
          .input('MpSellerCompanyId', sql.Int, sellerCompanyId)
          .input('MpPrice', sql.Decimal(18, 2), numericPrice)
          .query(`
            INSERT INTO [MarketplaceOrder] (AssetId, BuyerCompanyId, BuyerUserId, SellerCompanyId, Price, Status)
            VALUES (@MpAssetId, @MpBuyerCompanyId, @MpBuyerUserId, @MpSellerCompanyId, @MpPrice, 'PENDING')
          `)
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
      const numericPrice = parseBudgetToPrice(budgetStr)

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
  const pool = await getDbPool()

  // ── 24-hour cancel window check ──────────────────────────────────────────────
  // Fetch the order first to validate ownership and timing before attempting cancel.
  const checkReq = await pool.request()
    .input('OrderId', sql.Int, orderId)
    .query(`SELECT OrderId, CompanyId, CreatedByUserId, Status, CreatedAt FROM [CreativeOrder] WHERE OrderId = @OrderId AND IsDeleted = 0`)

  if (checkReq.recordset.length === 0) {
    throw new Error('ORDER_NOT_FOUND')
  }

  const existing = checkReq.recordset[0] as {
    CompanyId: number | null; CreatedByUserId: number | null;
    Status: CreativeOrderStatus; CreatedAt: Date
  }

  // Authorization check
  if (existing.CompanyId !== companyId && existing.CreatedByUserId !== userId) {
    throw new Error('ORDER_FORBIDDEN')
  }

  if (existing.Status === 'CANCELLED') {
    throw new Error('ORDER_ALREADY_CANCELLED')
  }

  // 24-hour window enforcement (server-side, cannot be bypassed from the client)
  const createdAt = new Date(existing.CreatedAt).getTime()
  const elapsed = Date.now() - createdAt
  if (elapsed > 24 * 60 * 60 * 1000) {
    throw new Error('ORDER_CANCEL_WINDOW_EXPIRED')
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Build WHERE clause that works regardless of whether the user has a companyId
  const cancelReq = pool.request()
    .input('OrderId', sql.Int, orderId)
    .input('UserId', sql.Int, userId)
    .input('Status', sql.NVarChar(50), 'CANCELLED')
    .input('UpdatedAt', sql.DateTime, new Date())

  let whereClause = `OrderId = @OrderId AND IsDeleted = 0 AND Status <> @Status`
  if (companyId) {
    cancelReq.input('CompanyId', sql.Int, companyId)
    whereClause += ` AND (CompanyId = @CompanyId OR CreatedByUserId = @UserId)`
  } else {
    whereClause += ` AND CreatedByUserId = @UserId`
  }

  const result = await cancelReq.query(`
    UPDATE [CreativeOrder]
    SET Status = @Status, UpdatedAt = @UpdatedAt
    OUTPUT INSERTED.*
    WHERE ${whereClause}
  `)

  if (result.recordset.length > 0) {
    return result.recordset[0]
  }

  throw new Error('ORDER_CANCEL_FAILED')
}
export const getAttachmentsForOrder = async (orderId: number): Promise<any[]> => {
  const pool = await getDbPool()
  const result = await pool.request()
    .input('OrderId', sql.Int, orderId)
    .query('SELECT AttachmentId, OrderId, FileName, MimeType, CreatedAt FROM OrderAttachment WHERE OrderId = @OrderId ORDER BY CreatedAt DESC')
  return result.recordset
}

export const getAttachmentById = async (attachmentId: number): Promise<any | null> => {
  const pool = await getDbPool()
  const result = await pool.request()
    .input('AttachmentId', sql.Int, attachmentId)
    .query('SELECT * FROM OrderAttachment WHERE AttachmentId = @AttachmentId')
  if (result.recordset.length === 0) return null
  const record = result.recordset[0]
  if (record.Base64Data && record.Base64Data.startsWith('file:')) {
    const filePath = record.Base64Data.slice(5) // strip 'file:'
    const absolutePath = path.resolve(process.cwd(), filePath)
    if (fs.existsSync(absolutePath)) {
      try {
        record.Base64Data = fs.readFileSync(absolutePath, 'utf8')
      } catch (err) {
        console.error(`Failed to read attachment file from disk: ${absolutePath}`, err)
      }
    } else {
      console.error(`Attachment file not found on disk at: ${absolutePath}`)
    }
  }
  return record
}

export const addAttachmentToOrder = async (orderId: number, attachment: { FileName: string; MimeType: string; Base64Data: string }): Promise<any> => {
  const pool = await getDbPool()
  const result = await pool.request()
    .input('OrderId', sql.Int, orderId)
    .input('FileName', sql.NVarChar(200), attachment.FileName)
    .input('MimeType', sql.NVarChar(100), attachment.MimeType)
    .input('Base64Data', sql.VarChar(sql.MAX), 'pending')
    .query(`
      INSERT INTO OrderAttachment (OrderId, FileName, MimeType, Base64Data)
      OUTPUT INSERTED.*
      VALUES (@OrderId, @FileName, @MimeType, @Base64Data)
    `)
  const record = result.recordset[0]
  const attachmentId = record.AttachmentId

  // Write file to uploads/attachments/
  const relativeDir = 'uploads/attachments'
  const absoluteDir = path.resolve(process.cwd(), relativeDir)
  if (!fs.existsSync(absoluteDir)) {
    fs.mkdirSync(absoluteDir, { recursive: true })
  }
  const fileNameOnDisk = `${attachmentId}_${attachment.FileName.replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`
  const relativePath = path.join(relativeDir, fileNameOnDisk)
  const absolutePath = path.join(absoluteDir, fileNameOnDisk)

  fs.writeFileSync(absolutePath, attachment.Base64Data, 'utf8')

  // Update DB with the file path reference
  const dbPath = `file:${relativePath.replace(/\\/g, '/')}`
  await pool.request()
    .input('AttachmentId', sql.Int, attachmentId)
    .input('Base64Data', sql.VarChar(sql.MAX), dbPath)
    .query('UPDATE OrderAttachment SET Base64Data = @Base64Data WHERE AttachmentId = @AttachmentId')

  record.Base64Data = attachment.Base64Data
  return record
}

export const deleteAttachment = async (attachmentId: number): Promise<void> => {
  const pool = await getDbPool()
  
  // Get the file reference before deleting the row
  const getRes = await pool.request()
    .input('AttachmentId', sql.Int, attachmentId)
    .query('SELECT Base64Data FROM OrderAttachment WHERE AttachmentId = @AttachmentId')
  
  if (getRes.recordset.length > 0) {
    const base64Data = getRes.recordset[0].Base64Data
    if (base64Data && base64Data.startsWith('file:')) {
      const filePath = base64Data.slice(5)
      const absolutePath = path.resolve(process.cwd(), filePath)
      if (fs.existsSync(absolutePath)) {
        try {
          fs.unlinkSync(absolutePath)
        } catch (err) {
          console.error(`Failed to delete attachment file from disk: ${absolutePath}`, err)
        }
      }
    }
  }

  const result = await pool.request()
    .input('AttachmentId', sql.Int, attachmentId)
    .query('DELETE FROM OrderAttachment WHERE AttachmentId = @AttachmentId')

  if (result.rowsAffected[0] === 0) {
    throw new Error('ATTACHMENT_NOT_FOUND')
  }
}
