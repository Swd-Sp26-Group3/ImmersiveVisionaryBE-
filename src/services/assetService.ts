import fs from 'fs'
import path from 'path'
import sql from 'mssql'
import { getDbPool } from '../config/database'

export type AssetType = 'ORDER' | 'MARKETPLACE' | 'TEMPLATE'
export type AssetPublishStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED'

export interface Asset3D {
  AssetId: number
  OrderId: number | null
  AssetName: string
  Description: string | null
  PreviewImage: string | null
  CreatedBy: number
  OwnerCompanyId: number | null
  AssetType: AssetType | null
  Price: number | null
  IsMarketplace: boolean
  Category: string | null
  Industry: string | null
  Base64Data: string | null
  PublishStatus: AssetPublishStatus
  CreatedAt: Date
  UpdatedAt: Date | null
  IsDeleted: boolean
}

export interface CreateAssetInput {
  OrderId?: number | null
  AssetName: string
  Description?: string | null
  PreviewImage?: string | null
  OwnerCompanyId?: number | null
  AssetType?: AssetType | null
  Price?: number | null
  IsMarketplace?: boolean
  Category?: string | null
  Industry?: string | null
  Base64Data?: string | null
}

export interface UpdateAssetInput {
  OrderId?: number | null
  AssetName?: string
  Description?: string | null
  PreviewImage?: string | null
  OwnerCompanyId?: number | null
  AssetType?: AssetType | null
  Price?: number | null
  IsMarketplace?: boolean
  Category?: string | null
  Industry?: string | null
  Base64Data?: string | null
}

export const createAsset = async (createdBy: number, payload: CreateAssetInput): Promise<Asset3D> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('OrderId', sql.Int, payload.OrderId ?? null)
    .input('AssetName', sql.NVarChar(200), payload.AssetName)
    .input('Description', sql.NVarChar(sql.MAX), payload.Description ?? null)
    .input('PreviewImage', sql.NVarChar(sql.MAX), payload.PreviewImage ?? null)
    .input('CreatedBy', sql.Int, createdBy)
    .input('OwnerCompanyId', sql.Int, payload.OwnerCompanyId ?? null)
    .input('AssetType', sql.NVarChar(50), payload.AssetType ?? null)
    .input('Price', sql.Decimal(18, 2), payload.Price ?? null)
    .input('IsMarketplace', sql.Bit, payload.IsMarketplace ?? false)
    .input('Category', sql.NVarChar(100), payload.Category ?? null)
    .input('Industry', sql.NVarChar(100), payload.Industry ?? null)
    .input('Base64Data', sql.VarChar(sql.MAX), 'pending')
    .input('PublishStatus', sql.NVarChar(50), 'DRAFT')
    .query(`
      INSERT INTO [Asset3D] (
        OrderId,
        AssetName,
        Description,
        PreviewImage,
        CreatedBy,
        OwnerCompanyId,
        AssetType,
        Price,
        IsMarketplace,
        Category,
        Industry,
        Base64Data,
        PublishStatus
      )
      OUTPUT INSERTED.*
      VALUES (
        @OrderId,
        @AssetName,
        @Description,
        @PreviewImage,
        @CreatedBy,
        @OwnerCompanyId,
        @AssetType,
        @Price,
        @IsMarketplace,
        @Category,
        @Industry,
        @Base64Data,
        @PublishStatus
      )
    `)

  const record = result.recordset[0]
  if (payload.Base64Data) {
    const assetId = record.AssetId
    const relativeDir = 'uploads/assets'
    const absoluteDir = path.resolve(process.cwd(), relativeDir)
    if (!fs.existsSync(absoluteDir)) {
      fs.mkdirSync(absoluteDir, { recursive: true })
    }
    const fileNameOnDisk = `${assetId}_${payload.AssetName.replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`
    const relativePath = path.join(relativeDir, fileNameOnDisk)
    const absolutePath = path.join(absoluteDir, fileNameOnDisk)

    fs.writeFileSync(absolutePath, payload.Base64Data, 'utf8')

    const dbPath = `file:${relativePath.replace(/\\/g, '/')}`
    await pool.request()
      .input('AssetId', sql.Int, assetId)
      .input('Base64Data', sql.VarChar(sql.MAX), dbPath)
      .query('UPDATE [Asset3D] SET Base64Data = @Base64Data WHERE AssetId = @AssetId')

    record.Base64Data = payload.Base64Data
  } else {
    await pool.request()
      .input('AssetId', sql.Int, record.AssetId)
      .query('UPDATE [Asset3D] SET Base64Data = NULL WHERE AssetId = @AssetId')
    record.Base64Data = null
  }

  return record
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

  const record = result.recordset[0]
  if (record.Base64Data && record.Base64Data.startsWith('file:')) {
    const filePath = record.Base64Data.slice(5) // strip 'file:'
    const absolutePath = path.resolve(process.cwd(), filePath)
    if (fs.existsSync(absolutePath)) {
      try {
        record.Base64Data = fs.readFileSync(absolutePath, 'utf8')
      } catch (err) {
        console.error(`Failed to read asset file from disk: ${absolutePath}`, err)
      }
    } else {
      console.error(`Asset file not found on disk at: ${absolutePath}`)
    }
  }

  return record
}

// Publish pending or draft on Artist page
export const listMyAssets = async (createdBy: number): Promise<Asset3D[]> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('CreatedBy', sql.Int, createdBy)
    .query(`
      SELECT AssetId, OrderId, AssetName, Description, PreviewImage, CreatedBy,
             OwnerCompanyId, AssetType, Price, IsMarketplace, Category, Industry,
             PublishStatus, CreatedAt, UpdatedAt, IsDeleted
      FROM [Asset3D]
      WHERE CreatedBy = @CreatedBy AND IsDeleted = 0
      ORDER BY CreatedAt DESC
    `)

  return result.recordset
}

export const listAllAssets = async (): Promise<Asset3D[]> => {
  const pool = await getDbPool()

  const result = await pool.request().query(`
    SELECT AssetId, OrderId, AssetName, Description, PreviewImage, CreatedBy,
           OwnerCompanyId, AssetType, Price, IsMarketplace, Category, Industry,
           PublishStatus, CreatedAt, UpdatedAt, IsDeleted
    FROM [Asset3D]
    WHERE IsDeleted = 0
    ORDER BY CreatedAt DESC
  `)

  return result.recordset
}

export const listMarketplaceAssets = async (): Promise<Asset3D[]> => {
  const pool = await getDbPool()

  const result = await pool.request().query(`
    SELECT AssetId, OrderId, AssetName, Description, PreviewImage, CreatedBy,
           OwnerCompanyId, AssetType, Price, IsMarketplace, Category, Industry,
           PublishStatus, CreatedAt, UpdatedAt, IsDeleted
    FROM [Asset3D]
    WHERE IsDeleted = 0 AND IsMarketplace = 1 AND PublishStatus = 'PUBLISHED'
    ORDER BY CreatedAt DESC
  `)

  return result.recordset
}

export const updateAsset = async (assetId: number, payload: UpdateAssetInput): Promise<Asset3D> => {
  const pool = await getDbPool()

  let dbBase64Data: string | undefined = undefined
  if (payload.Base64Data !== undefined) {
    if (payload.Base64Data) {
      const assetRes = await pool.request().input('AssetId', sql.Int, assetId).query('SELECT AssetName FROM [Asset3D] WHERE AssetId = @AssetId')
      const assetName = assetRes.recordset[0]?.AssetName || 'asset'
      const relativeDir = 'uploads/assets'
      const absoluteDir = path.resolve(process.cwd(), relativeDir)
      if (!fs.existsSync(absoluteDir)) {
        fs.mkdirSync(absoluteDir, { recursive: true })
      }
      const fileNameOnDisk = `${assetId}_${assetName.replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`
      const relativePath = path.join(relativeDir, fileNameOnDisk)
      const absolutePath = path.join(absoluteDir, fileNameOnDisk)

      fs.writeFileSync(absolutePath, payload.Base64Data, 'utf8')
      dbBase64Data = `file:${relativePath.replace(/\\/g, '/')}`
    } else {
      const getRes = await pool.request()
        .input('AssetId', sql.Int, assetId)
        .query('SELECT Base64Data FROM [Asset3D] WHERE AssetId = @AssetId')
      if (getRes.recordset.length > 0) {
        const base64Data = getRes.recordset[0].Base64Data
        if (base64Data && base64Data.startsWith('file:')) {
          const filePath = base64Data.slice(5)
          const absolutePath = path.resolve(process.cwd(), filePath)
          if (fs.existsSync(absolutePath)) {
            try { fs.unlinkSync(absolutePath) } catch {}
          }
        }
      }
      dbBase64Data = null as any
    }
  }

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

  if (payload.Description !== undefined) {
    setParts.push('Description = @Description')
    request.input('Description', sql.NVarChar(sql.MAX), payload.Description)
  }

  if (payload.PreviewImage !== undefined) {
    setParts.push('PreviewImage = @PreviewImage')
    request.input('PreviewImage', sql.NVarChar(sql.MAX), payload.PreviewImage)
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

  if (dbBase64Data !== undefined) {
    setParts.push('Base64Data = @Base64Data')
    request.input('Base64Data', sql.VarChar(sql.MAX), dbBase64Data)
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

  const record = result.recordset[0]
  if (payload.Base64Data !== undefined) {
    record.Base64Data = payload.Base64Data
  }
  return record
}

export const deleteAsset = async (assetId: number): Promise<void> => {
  const pool = await getDbPool()

  const getRes = await pool.request()
    .input('AssetId', sql.Int, assetId)
    .query('SELECT Base64Data FROM [Asset3D] WHERE AssetId = @AssetId')
  
  if (getRes.recordset.length > 0) {
    const base64Data = getRes.recordset[0].Base64Data
    if (base64Data && base64Data.startsWith('file:')) {
      const filePath = base64Data.slice(5)
      const absolutePath = path.resolve(process.cwd(), filePath)
      if (fs.existsSync(absolutePath)) {
        try {
          fs.unlinkSync(absolutePath)
        } catch (err) {
          console.error(`Failed to delete asset file from disk: ${absolutePath}`, err)
        }
      }
    }
  }

  const result = await pool
    .request()
    .input('AssetId', sql.Int, assetId)
    .input('UpdatedAt', sql.DateTime, new Date())
    .query(`
      UPDATE [Asset3D]
      SET IsDeleted = 1, Base64Data = NULL, UpdatedAt = @UpdatedAt
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

  // Fetch the asset to get CreatedBy so we can resolve OwnerCompanyId if missing
  const assetRes = await pool
    .request()
    .input('AssetId', sql.Int, assetId)
    .query(`
      SELECT a.AssetId, a.PublishStatus, a.OwnerCompanyId, a.CreatedBy, u.CompanyId as CreatorCompanyId
      FROM [Asset3D] a
      LEFT JOIN [User] u ON a.CreatedBy = u.UserId
      WHERE a.AssetId = @AssetId AND a.IsDeleted = 0
    `)

  if (assetRes.recordset.length === 0) {
    throw new Error('ASSET_NOT_FOUND')
  }

  const asset = assetRes.recordset[0]

  if (asset.PublishStatus !== 'PENDING') {
    throw new Error('ASSET_CANNOT_APPROVE')
  }

  // Resolve OwnerCompanyId: keep existing if set, otherwise fall back to creator's company
  const resolvedOwnerCompanyId = asset.OwnerCompanyId ?? asset.CreatorCompanyId ?? null

  const request = pool
    .request()
    .input('AssetId', sql.Int, assetId)
    .input('PublishStatus', sql.NVarChar(50), 'PUBLISHED')
    .input('IsMarketplace', sql.Bit, true)
    .input('UpdatedAt', sql.DateTime, new Date())

  let ownerSet = ''
  if (resolvedOwnerCompanyId !== null) {
    request.input('OwnerCompanyId', sql.Int, resolvedOwnerCompanyId)
    ownerSet = ', OwnerCompanyId = @OwnerCompanyId'
  }

  const result = await request.query(`
    UPDATE [Asset3D]
    SET PublishStatus = @PublishStatus,
        IsMarketplace = @IsMarketplace,
        UpdatedAt = @UpdatedAt
        ${ownerSet}
    OUTPUT INSERTED.*
    WHERE AssetId = @AssetId AND IsDeleted = 0
  `)

  if (result.recordset.length === 0) {
    throw new Error('ASSET_NOT_FOUND')
  }

  return result.recordset[0]
}

