import sql from 'mssql'
import { getDbPool } from '../config/database'

export type MarketplaceOrderStatus = 'PENDING' | 'PAID' | 'DELIVERED' | 'REFUNDED'

export interface MarketplaceOrder {
  MpOrderId: number
  AssetId: number
  BuyerCompanyId: number
  BuyerUserId: number | null
  SellerCompanyId: number
  Price: number | null
  Status: MarketplaceOrderStatus | null
  CreatedAt: Date
  AssetName?: string | null
  BuyerCompanyName?: string | null
  SellerCompanyName?: string | null
  BuyerName?: string | null
  BuyerPhone?: string | null
}

export interface CreateMarketplaceOrderInput {
  AssetId: number
  BuyerCompanyId?: number
  BuyerUserId?: number
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

/**
 * Gets user's CompanyId, auto-creating a 'Personal Account' company if the user has none.
 */
const getOrCreateUserCompanyId = async (userId: number): Promise<number> => {
  const existing = await getUserCompanyId(userId)
  if (existing) return existing

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

const getAssetForMarketplace = async (assetId: number): Promise<{ AssetId: number; OwnerCompanyId: number; Price: number | null } | null> => {
  const pool = await getDbPool()

  const result = await pool.request().input('AssetId', sql.Int, assetId).query(`
    SELECT AssetId, OwnerCompanyId, Price
    FROM [Asset3D]
    WHERE AssetId = @AssetId
      AND IsDeleted = 0
      AND IsMarketplace = 1
      AND PublishStatus = 'PUBLISHED'
      AND OwnerCompanyId IS NOT NULL
  `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0]
}

export const createMarketplaceOrder = async (
  userId: number,
  roleName: string,
  payload: CreateMarketplaceOrderInput
): Promise<MarketplaceOrder> => {
  const normalizedRole = roleName.toUpperCase()

  let buyerCompanyId: number

  if (normalizedRole === 'ADMIN' || normalizedRole === 'MANAGER') {
    const userCompanyId = await getUserCompanyId(userId)
    const resolved = payload.BuyerCompanyId ?? userCompanyId
    if (!resolved) throw new Error('BUYER_COMPANY_NOT_FOUND')
    buyerCompanyId = resolved
  } else {
    // Auto-create a Personal Account company for users who don't have one yet
    buyerCompanyId = await getOrCreateUserCompanyId(userId)
  }

  const asset = await getAssetForMarketplace(payload.AssetId)
  if (!asset) {
    throw new Error('ASSET_NOT_AVAILABLE')
  }

  if (asset.OwnerCompanyId === buyerCompanyId) {
    throw new Error('CANNOT_BUY_OWN_ASSET')
  }

  const pool = await getDbPool()

  const duplicated = await pool
    .request()
    .input('AssetId', sql.Int, payload.AssetId)
    .input('BuyerCompanyId', sql.Int, buyerCompanyId)
    .query(`
      SELECT TOP 1 MpOrderId
      FROM [MarketplaceOrder]
      WHERE AssetId = @AssetId
        AND BuyerCompanyId = @BuyerCompanyId
        AND Status IN ('PENDING', 'PAID', 'DELIVERED')
      ORDER BY MpOrderId DESC
    `)

  if (duplicated.recordset.length > 0) {
    throw new Error('ORDER_ALREADY_EXISTS')
  }

  const result = await pool
    .request()
    .input('AssetId', sql.Int, payload.AssetId)
    .input('BuyerCompanyId', sql.Int, buyerCompanyId)
    .input('BuyerUserId', sql.Int, userId)
    .input('SellerCompanyId', sql.Int, asset.OwnerCompanyId)
    .input('Price', sql.Decimal(18, 2), asset.Price)
    .input('Status', sql.NVarChar(50), 'PENDING')
    .query(`
      INSERT INTO [MarketplaceOrder] (AssetId, BuyerCompanyId, BuyerUserId, SellerCompanyId, Price, Status)
      OUTPUT INSERTED.*
      VALUES (@AssetId, @BuyerCompanyId, @BuyerUserId, @SellerCompanyId, @Price, @Status)
    `)

  return result.recordset[0]
}

/**
 * Creates a MarketplaceOrder for internal use (e.g. from a custom CreativeOrder completion)
 * Bypasses public marketplace visibility checks.
 */
export const createInternalMarketplaceOrder = async (
  assetId: number,
  buyerCompanyId: number,
  buyerUserId: number | null,
  sellerCompanyId: number,
  price: number | null
): Promise<MarketplaceOrder> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('AssetId', sql.Int, assetId)
    .input('BuyerCompanyId', sql.Int, buyerCompanyId)
    .input('BuyerUserId', sql.Int, buyerUserId)
    .input('SellerCompanyId', sql.Int, sellerCompanyId)
    .input('Price', sql.Decimal(18, 2), price)
    .input('Status', sql.NVarChar(50), 'PENDING')
    .query(`
      INSERT INTO [MarketplaceOrder] (AssetId, BuyerCompanyId, BuyerUserId, SellerCompanyId, Price, Status)
      OUTPUT INSERTED.*
      VALUES (@AssetId, @BuyerCompanyId, @BuyerUserId, @SellerCompanyId, @Price, @Status)
    `)

  return result.recordset[0]
}

export const listMyPurchases = async (userId: number): Promise<MarketplaceOrder[]> => {
  const buyerCompanyId = await getUserCompanyId(userId)
  const pool = await getDbPool()

  // If user has no company, query by BuyerUserId
  if (!buyerCompanyId) {
    const result = await pool
      .request()
      .input('BuyerUserId', sql.Int, userId)
      .query(`
        SELECT mo.*, bu.UserName as BuyerName, bu.Phone as BuyerPhone, a.AssetName
        FROM [MarketplaceOrder] mo
        LEFT JOIN [User] bu ON mo.BuyerUserId = bu.UserId
        LEFT JOIN [Asset3D] a ON mo.AssetId = a.AssetId
        WHERE mo.BuyerUserId = @BuyerUserId
        ORDER BY mo.MpOrderId DESC
      `)
    return result.recordset
  }

  const result = await pool
    .request()
    .input('BuyerCompanyId', sql.Int, buyerCompanyId)
    .input('BuyerUserId', sql.Int, userId)
    .query(`
      SELECT mo.*, bu.UserName as BuyerName, bu.Phone as BuyerPhone, a.AssetName
      FROM [MarketplaceOrder] mo
      LEFT JOIN [User] bu ON mo.BuyerUserId = bu.UserId
      LEFT JOIN [Asset3D] a ON mo.AssetId = a.AssetId
      WHERE mo.BuyerCompanyId = @BuyerCompanyId OR mo.BuyerUserId = @BuyerUserId
      ORDER BY mo.MpOrderId DESC
    `)

  return result.recordset
}

export const listAllMarketplaceOrders = async (): Promise<MarketplaceOrder[]> => {
  const pool = await getDbPool()
  const result = await pool.request().query(`
    SELECT
      mo.*,
      a.AssetName,
      bc.CompanyName AS BuyerCompanyName,
      sc.CompanyName AS SellerCompanyName,
      bu.UserName AS BuyerName,
      bu.Phone AS BuyerPhone
    FROM [MarketplaceOrder] mo
    LEFT JOIN Asset3D  a   ON mo.AssetId         = a.AssetId
    LEFT JOIN Company  bc  ON mo.BuyerCompanyId  = bc.CompanyId
    LEFT JOIN Company  sc  ON mo.SellerCompanyId = sc.CompanyId
    LEFT JOIN [User]   bu  ON mo.BuyerUserId      = bu.UserId
    ORDER BY mo.CreatedAt DESC
  `)
  return result.recordset
}

export const getMarketplaceOrderDetail = async (
  userId: number,
  roleName: string,
  mpOrderId: number
): Promise<MarketplaceOrder | null> => {
  const normalizedRole = roleName.toUpperCase()
  const pool = await getDbPool()

  if (normalizedRole === 'ADMIN' || normalizedRole === 'MANAGER') {
    const result = await pool.request().input('MpOrderId', sql.Int, mpOrderId).query(`
      SELECT mo.*, bu.UserName as BuyerName, bu.Phone as BuyerPhone
      FROM [MarketplaceOrder] mo
      LEFT JOIN [User] bu ON mo.BuyerUserId = bu.UserId
      WHERE mo.MpOrderId = @MpOrderId
    `)

    return result.recordset[0] ?? null
  }

  const buyerCompanyId = await getUserCompanyId(userId)
  if (!buyerCompanyId) {
    return null
  }

  const result = await pool
    .request()
    .input('MpOrderId', sql.Int, mpOrderId)
    .input('BuyerCompanyId', sql.Int, buyerCompanyId)
    .query(`
      SELECT mo.*, bu.UserName as BuyerName, bu.Phone as BuyerPhone
      FROM [MarketplaceOrder] mo
      LEFT JOIN [User] bu ON mo.BuyerUserId = bu.UserId
      WHERE mo.MpOrderId = @MpOrderId AND mo.BuyerCompanyId = @BuyerCompanyId
    `)

  return result.recordset[0] ?? null
}

export const refundMarketplaceOrder = async (
  userId: number,
  roleName: string,
  mpOrderId: number
): Promise<MarketplaceOrder> => {
  const normalizedRole = roleName.toUpperCase()
  const pool = await getDbPool()

  let buyerCompanyId: number | null = null

  if (normalizedRole !== 'ADMIN' && normalizedRole !== 'MANAGER') {
    buyerCompanyId = await getUserCompanyId(userId)
    if (!buyerCompanyId) {
      throw new Error('ORDER_NOT_FOUND')
    }
  }

  const request = pool
    .request()
    .input('MpOrderId', sql.Int, mpOrderId)
    .input('Status', sql.NVarChar(50), 'REFUNDED')

  let whereClause = `MpOrderId = @MpOrderId`
  if (buyerCompanyId) {
    request.input('BuyerCompanyId', sql.Int, buyerCompanyId)
    whereClause += ` AND BuyerCompanyId = @BuyerCompanyId`
  }

  const result = await request.query(`
    UPDATE [MarketplaceOrder]
    SET Status = @Status
    OUTPUT INSERTED.*
    WHERE ${whereClause} AND Status IN ('PAID', 'DELIVERED')
  `)

  if (result.recordset.length > 0) {
    return result.recordset[0]
  }

  const existing = await getMarketplaceOrderDetail(userId, roleName, mpOrderId)
  if (!existing) {
    throw new Error('ORDER_NOT_FOUND')
  }

  throw new Error('ORDER_CANNOT_REFUND')
}

export const updateMarketplaceOrderStatus = async (
  mpOrderId: number,
  status: MarketplaceOrderStatus
): Promise<MarketplaceOrder> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('MpOrderId', sql.Int, mpOrderId)
    .input('Status', sql.NVarChar(50), status)
    .query(`
      UPDATE [MarketplaceOrder]
      SET Status = @Status
      OUTPUT INSERTED.*
      WHERE MpOrderId = @MpOrderId
    `)

  if (result.recordset.length === 0) {
    throw new Error('ORDER_NOT_FOUND')
  }

  return result.recordset[0]
}

export const findPendingMarketplaceOrder = async (
  assetId: number,
  companyId: number
): Promise<MarketplaceOrder | null> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('AssetId', sql.Int, assetId)
    .input('BuyerCompanyId', sql.Int, companyId)
    .query(`
      SELECT TOP 1 *
      FROM [MarketplaceOrder]
      WHERE AssetId = @AssetId
        AND BuyerCompanyId = @BuyerCompanyId
        AND Status = 'PENDING'
      ORDER BY MpOrderId DESC
    `)

  return result.recordset[0] ?? null
}
