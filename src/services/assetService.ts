import sql from 'mssql'
import { getDbPool } from '../config/database'

export type AssetType = 'ORDER' | 'MARKETPLACE' | 'TEMPLATE'
export type AssetPublishStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED'

export interface Asset3D {
  AssetId: number
  OrderId: number | null
  AssetName: string
  PreviewImage: string | null
  CreatedBy: number
  OwnerCompanyId: number | null
  AssetType: AssetType | null
  Price: number | null
  IsMarketplace: boolean
  Category: string | null
  Industry: string | null
  PublishStatus: AssetPublishStatus
  CreatedAt: Date
  UpdatedAt: Date | null
  IsDeleted: boolean
}

export interface CreateAssetInput {
  OrderId?: number | null
  AssetName: string
  PreviewImage?: string | null
  OwnerCompanyId?: number | null
  AssetType?: AssetType | null
  Price?: number | null
  IsMarketplace?: boolean
  Category?: string | null
  Industry?: string | null
}

export interface UpdateAssetInput {
  OrderId?: number | null
  AssetName?: string
  PreviewImage?: string | null
  OwnerCompanyId?: number | null
  AssetType?: AssetType | null
  Price?: number | null
  IsMarketplace?: boolean
  Category?: string | null
  Industry?: string | null
}

export const createAsset = async (createdBy: number, payload: CreateAssetInput): Promise<Asset3D> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('OrderId', sql.Int, payload.OrderId ?? null)
    .input('AssetName', sql.NVarChar(200), payload.AssetName)
    .input('PreviewImage', sql.NVarChar(500), payload.PreviewImage ?? null)
    .input('CreatedBy', sql.Int, createdBy)
    .input('OwnerCompanyId', sql.Int, payload.OwnerCompanyId ?? null)
    .input('AssetType', sql.NVarChar(50), payload.AssetType ?? null)
    .input('Price', sql.Decimal(18, 2), payload.Price ?? null)
    .input('IsMarketplace', sql.Bit, payload.IsMarketplace ?? false)
    .input('Category', sql.NVarChar(100), payload.Category ?? null)
    .input('Industry', sql.NVarChar(100), payload.Industry ?? null)
    .input('PublishStatus', sql.NVarChar(50), 'DRAFT')
    .query(`
      INSERT INTO [Asset3D] (
        OrderId,
        AssetName,
        PreviewImage,
        CreatedBy,
        OwnerCompanyId,
        AssetType,
        Price,
        IsMarketplace,
        Category,
        Industry,
        PublishStatus
      )
      OUTPUT INSERTED.*
      VALUES (
        @OrderId,
        @AssetName,
        @PreviewImage,
        @CreatedBy,
        @OwnerCompanyId,
        @AssetType,
        @Price,
        @IsMarketplace,
        @Category,
        @Industry,
        @PublishStatus
      )
    `)

  return result.recordset[0]
}

export const getAssetById = async (assetId: number): Promise<Asset3D | null> => {
  const pool = await getDbPool()

  const result = await pool.request().input('AssetId', sql.Int, assetId).query(`
    SELECT *
    FROM [Asset3D]
    WHERE AssetId = @AssetId AND IsDeleted = 0
  `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0]
}

// Publish pending or draft on Artist page
export const listMyAssets = async (createdBy: number): Promise<Asset3D[]> => {
  const pool = await getDbPool()
 
  const result = await pool
    .request()
    .input('CreatedBy', sql.Int, createdBy)
    .query(`
      SELECT *
      FROM [Asset3D]
      WHERE CreatedBy = @CreatedBy AND IsDeleted = 0
      ORDER BY CreatedAt DESC
    `)
 
  return result.recordset
}

export const listAllAssets = async (): Promise<Asset3D[]> => {
  const pool = await getDbPool()
 
  const result = await pool.request().query(`
    SELECT * FROM [Asset3D]
    WHERE IsDeleted = 0
    ORDER BY CreatedAt DESC
  `)
 
  return result.recordset
}

export const listMarketplaceAssets = async (): Promise<Asset3D[]> => {
  const pool = await getDbPool()

  const result = await pool.request().query(`
    SELECT *
    FROM [Asset3D]
    WHERE IsDeleted = 0 AND IsMarketplace = 1 AND PublishStatus = 'PUBLISHED'
    ORDER BY CreatedAt DESC
  `)

  return result.recordset
}

export const updateAsset = async (assetId: number, payload: UpdateAssetInput): Promise<Asset3D> => {
  const pool = await getDbPool()

  const setParts: string[] = []
  const request = pool.request().input('AssetId', sql.Int, assetId).input('UpdatedAt', sql.DateTime, new Date())

  if (payload.OrderId !== undefined) {
    setParts.push('OrderId = @OrderId')
    request.input('OrderId', sql.Int, payload.OrderId)
  }

  if (payload.AssetName !== undefined) {
    setParts.push('AssetName = @AssetName')
    request.input('AssetName', sql.NVarChar(200), payload.AssetName)
  }

  if (payload.PreviewImage !== undefined) {
    setParts.push('PreviewImage = @PreviewImage')
    request.input('PreviewImage', sql.NVarChar(500), payload.PreviewImage)
  }

  if (payload.OwnerCompanyId !== undefined) {
    setParts.push('OwnerCompanyId = @OwnerCompanyId')
    request.input('OwnerCompanyId', sql.Int, payload.OwnerCompanyId)
  }

  if (payload.AssetType !== undefined) {
    setParts.push('AssetType = @AssetType')
    request.input('AssetType', sql.NVarChar(50), payload.AssetType)
  }

  if (payload.Price !== undefined) {
    setParts.push('Price = @Price')
    request.input('Price', sql.Decimal(18, 2), payload.Price)
  }

  if (payload.IsMarketplace !== undefined) {
    setParts.push('IsMarketplace = @IsMarketplace')
    request.input('IsMarketplace', sql.Bit, payload.IsMarketplace)
  }

  if (payload.Category !== undefined) {
    setParts.push('Category = @Category')
    request.input('Category', sql.NVarChar(100), payload.Category)
  }

  if (payload.Industry !== undefined) {
    setParts.push('Industry = @Industry')
    request.input('Industry', sql.NVarChar(100), payload.Industry)
  }

  if (setParts.length === 0) {
    throw new Error('NO_UPDATE_FIELDS')
  }

  setParts.push('UpdatedAt = @UpdatedAt')

  const result = await request.query(`
    UPDATE [Asset3D]
    SET ${setParts.join(', ')}
    OUTPUT INSERTED.*
    WHERE AssetId = @AssetId AND IsDeleted = 0
  `)

  if (result.recordset.length === 0) {
    throw new Error('ASSET_NOT_FOUND')
  }

  return result.recordset[0]
}

export const deleteAsset = async (assetId: number): Promise<void> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('AssetId', sql.Int, assetId)
    .input('UpdatedAt', sql.DateTime, new Date())
    .query(`
      UPDATE [Asset3D]
      SET IsDeleted = 1, UpdatedAt = @UpdatedAt
      WHERE AssetId = @AssetId AND IsDeleted = 0
    `)

  if (result.rowsAffected[0] === 0) {
    throw new Error('ASSET_NOT_FOUND')
  }
}

export const submitAssetForPublish = async (assetId: number): Promise<Asset3D> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('AssetId', sql.Int, assetId)
    .input('PublishStatus', sql.NVarChar(50), 'PENDING')
    .input('IsMarketplace', sql.Bit, true)
    .input('UpdatedAt', sql.DateTime, new Date())
    .query(`
      UPDATE [Asset3D]
      SET PublishStatus = @PublishStatus,
          IsMarketplace = @IsMarketplace,
          UpdatedAt = @UpdatedAt
      OUTPUT INSERTED.*
      WHERE AssetId = @AssetId AND IsDeleted = 0 AND PublishStatus = 'DRAFT'
    `)

  if (result.recordset.length > 0) {
    return result.recordset[0]
  }

  const existing = await getAssetById(assetId)
  if (!existing) {
    throw new Error('ASSET_NOT_FOUND')
  }

  throw new Error('ASSET_CANNOT_SUBMIT')
}

export const approveAsset = async (assetId: number): Promise<Asset3D> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('AssetId', sql.Int, assetId)
    .input('PublishStatus', sql.NVarChar(50), 'PUBLISHED')
    .input('IsMarketplace', sql.Bit, true)
    .input('UpdatedAt', sql.DateTime, new Date())
    .query(`
      UPDATE [Asset3D]
      SET PublishStatus = @PublishStatus,
          IsMarketplace = @IsMarketplace,
          UpdatedAt = @UpdatedAt
      OUTPUT INSERTED.*
      WHERE AssetId = @AssetId AND IsDeleted = 0 AND PublishStatus = 'PENDING'
    `)

  if (result.recordset.length > 0) {
    return result.recordset[0]
  }

  const existing = await getAssetById(assetId)
  if (!existing) {
    throw new Error('ASSET_NOT_FOUND')
  }

  throw new Error('ASSET_CANNOT_APPROVE')
}
