import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import type { Response } from 'express'
import type { AuthRequest } from '../middlewares/authMiddleware'
import {
  approveAsset,
  createAsset,
  deleteAsset,
  getAssetById,
  listAllAssets,
  listMarketplaceAssets,
  listMyAssets,
  submitAssetForPublish,
  updateAsset,
  type AssetType
} from '../services/assetService'

const ALLOWED_ASSET_TYPES: AssetType[] = ['ORDER', 'MARKETPLACE', 'TEMPLATE']

/**
 * If the FE sent a gzip-compressed payload (prefix "gzip:"), decompress it
 * and return a plain base64 data URL. Otherwise pass through unchanged.
 */
export const decompressBase64 = (raw: string | null | undefined): string | null | undefined => {
  if (!raw || !raw.startsWith('gzip:')) return raw
  try {
    const b64 = raw.slice(5) // strip "gzip:"
    const compressed = Buffer.from(b64, 'base64')
    const decompressed = zlib.gunzipSync(compressed)
    
    // Tự động nhận dạng MIME type dựa trên magic bytes của file sau giải nén
    let mimePrefix = 'data:application/octet-stream;base64,'
    if (decompressed.length >= 4) {
      const magic = decompressed.readUInt32BE(0)
      if (magic === 0x504B0304) {
        // ZIP magic: "PK\x03\x04"
        mimePrefix = 'data:application/zip;base64,'
      } else if (magic === 0x676C5446) {
        // glTF binary magic: "glTF"
        mimePrefix = 'data:model/gltf-binary;base64,'
      } else {
        // Kiểm tra xem có phải file văn bản ASCII (như .obj, .gltf JSON) hay không
        const checkLen = Math.min(decompressed.length, 100)
        let isAscii = true
        for (let i = 0; i < checkLen; i++) {
          const b = decompressed[i]
          if (b !== 9 && b !== 10 && b !== 13 && (b < 32 || b > 126)) {
            isAscii = false
            break
          }
        }
        if (isAscii) {
          mimePrefix = 'data:text/plain;charset=utf-8;base64,'
        }
      }
    }

    return mimePrefix + decompressed.toString('base64')
  } catch (e) {
    console.error('[decompressBase64] Failed to decompress:', e)
    throw new Error('INVALID_COMPRESSED_DATA')
  }
}

export const resolveUploadedBase64 = (parsedBase64Data: string | null | undefined, uploadId: unknown): string | null | undefined => {
  if (uploadId) {
    if (typeof uploadId !== 'string') {
      throw new Error('INVALID_UPLOAD_ID')
    }
    const tempDir = path.resolve(process.cwd(), 'uploads/temp', uploadId)
    const assembledPath = path.join(tempDir, 'assembled.bin')
    const metadataPath = path.join(tempDir, 'metadata.json')

    if (fs.existsSync(assembledPath)) {
      const fullBuffer = fs.readFileSync(assembledPath)
      const base64Str = fullBuffer.toString('base64')

      let prefix = ''
      if (fs.existsSync(metadataPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
          prefix = meta.prefix || ''
        } catch {}
      }

      const finalBase64 = prefix && prefix !== 'raw' ? `${prefix}:${base64Str}` : base64Str

      // Clean up temporary files
      try {
        fs.unlinkSync(assembledPath)
        if (fs.existsSync(metadataPath)) fs.unlinkSync(metadataPath)
        fs.rmdirSync(tempDir)
      } catch (cleanupErr) {
        console.error('[resolveUploadedBase64] Temp cleanup failed:', cleanupErr)
      }

      return finalBase64
    } else {
      throw new Error('UPLOADED_FILE_NOT_FOUND')
    }
  }
  return parsedBase64Data
}

export const uploadChunkHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { uploadId, prefix, fileName } = req.body
    const chunkIndex = req.body.chunkIndex !== undefined ? Number(req.body.chunkIndex) : undefined
    const totalChunks = req.body.totalChunks !== undefined ? Number(req.body.totalChunks) : undefined

    if (!uploadId || chunkIndex === undefined || totalChunks === undefined || !req.file || !fileName) {
      res.status(400).json({ message: 'Missing required chunk parameters or file chunk' })
      return
    }

    const tempDir = path.resolve(process.cwd(), 'uploads/temp', uploadId)
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const chunkPath = path.join(tempDir, `${chunkIndex}.part`)
    fs.writeFileSync(chunkPath, req.file.buffer)

    // Check if we have received all chunks
    const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.part'))
    if (files.length === totalChunks) {
      // Reassemble the chunks
      const chunkBuffers: Buffer[] = []
      for (let i = 0; i < totalChunks; i++) {
        const partPath = path.join(tempDir, `${i}.part`)
        if (!fs.existsSync(partPath)) {
          res.status(400).json({ message: `Missing chunk index ${i}` })
          return
        }
        chunkBuffers.push(fs.readFileSync(partPath))
      }
      const fullBuffer = Buffer.concat(chunkBuffers)

      // Write assembled buffer to a temporary file
      const assembledPath = path.join(tempDir, 'assembled.bin')
      fs.writeFileSync(assembledPath, fullBuffer)

      // Write metadata (prefix, fileName)
      const metadata = { prefix, fileName }
      fs.writeFileSync(path.join(tempDir, 'metadata.json'), JSON.stringify(metadata), 'utf8')

      // Clean up temporary part chunks
      for (let i = 0; i < totalChunks; i++) {
        try {
          fs.unlinkSync(path.join(tempDir, `${i}.part`))
        } catch {}
      }

      res.status(201).json({ message: 'File uploaded and assembled successfully', uploadId })
    } else {
      res.status(200).json({ message: `Chunk ${chunkIndex + 1}/${totalChunks} received successfully` })
    }
  } catch (error) {
    console.error('Error in asset uploadChunkHandler:', error)
    res.status(500).json({ message: 'Server error during chunk upload' })
  }
}

const parseAssetId = (idParam: string): number | null => {
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

const parseOptionalInt = (value: unknown): number | null | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return undefined
  }

  return value
}

const parseOptionalNumber = (value: unknown): number | null | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return undefined
  }

  return value
}

const parseOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'boolean') {
    return undefined
  }

  return value
}

const parseOptionalAssetType = (value: unknown): AssetType | null | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'string' || !ALLOWED_ASSET_TYPES.includes(value as AssetType)) {
    return undefined
  }

  return value as AssetType
}

export const createAssetHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const { OrderId, AssetName, Description, PreviewImage, OwnerCompanyId, AssetType, Price, IsMarketplace, Category, Industry, Base64Data, UploadId } =
      req.body

    if (OrderId !== undefined && parseOptionalInt(OrderId) === undefined) {
      res.status(400).json({ message: 'OrderId must be a positive integer or null' })
      return
    }

    if (!AssetName || typeof AssetName !== 'string' || AssetName.trim() === '') {
      res.status(400).json({ message: 'AssetName is required' })
      return
    }

    const parsedDescription = parseOptionalString(Description)
    if (Description !== undefined && parsedDescription === undefined) {
      res.status(400).json({ message: 'Description must be a string or null' })
      return
    }

    const parsedPreviewImage = parseOptionalString(PreviewImage)
    if (PreviewImage !== undefined && parsedPreviewImage === undefined) {
      res.status(400).json({ message: 'PreviewImage must be a string or null' })
      return
    }

    if (OwnerCompanyId !== undefined && parseOptionalInt(OwnerCompanyId) === undefined) {
      res.status(400).json({ message: 'OwnerCompanyId must be a positive integer or null' })
      return
    }

    const parsedAssetType = parseOptionalAssetType(AssetType)
    if (AssetType !== undefined && parsedAssetType === undefined) {
      res.status(400).json({ message: `AssetType must be one of: ${ALLOWED_ASSET_TYPES.join(', ')} or null` })
      return
    }

    const parsedPrice = parseOptionalNumber(Price)
    if (Price !== undefined && parsedPrice === undefined) {
      res.status(400).json({ message: 'Price must be a number greater than or equal to 0 or null' })
      return
    }

    const parsedIsMarketplace = parseOptionalBoolean(IsMarketplace)
    if (IsMarketplace !== undefined && parsedIsMarketplace === undefined) {
      res.status(400).json({ message: 'IsMarketplace must be a boolean' })
      return
    }

    const parsedCategory = parseOptionalString(Category)
    if (Category !== undefined && parsedCategory === undefined) {
      res.status(400).json({ message: 'Category must be a string or null' })
      return
    }

    const parsedIndustry = parseOptionalString(Industry)
    if (Industry !== undefined && parsedIndustry === undefined) {
      res.status(400).json({ message: 'Industry must be a string or null' })
      return
    }

    let parsedBase64Data = parseOptionalString(Base64Data)
    if (Base64Data !== undefined && parsedBase64Data === undefined) {
      res.status(400).json({ message: 'Base64Data must be a string or null' })
      return
    }

    try {
      parsedBase64Data = resolveUploadedBase64(parsedBase64Data, UploadId)
    } catch (err: any) {
      if (err.message === 'INVALID_UPLOAD_ID') {
        res.status(400).json({ message: 'UploadId must be a string' })
        return
      }
      if (err.message === 'UPLOADED_FILE_NOT_FOUND') {
        res.status(400).json({ message: 'Assembled upload not found. The upload session may have timed out or failed.' })
        return
      }
      throw err
    }

    // Decompress if the FE sent a gzip-compressed payload
    const finalBase64Data = decompressBase64(parsedBase64Data)

    const asset = await createAsset(req.user.userId, {
      OrderId: parseOptionalInt(OrderId),
      AssetName: AssetName.trim(),
      Description: parsedDescription,
      PreviewImage: parsedPreviewImage,
      OwnerCompanyId: parseOptionalInt(OwnerCompanyId),
      AssetType: parsedAssetType,
      Price: parsedPrice,
      IsMarketplace: parsedIsMarketplace,
      Category: parsedCategory,
      Industry: parsedIndustry,
      Base64Data: finalBase64Data
    })

    res.status(201).json({
      message: 'Upload asset successfully',
      data: asset
    })
  } catch (error: any) {
    console.error('Error in createAssetHandler:', error?.message ?? error)
    console.error('Error details:', {
      number: error?.number,
      state: error?.state,
      class: error?.class,
      lineNumber: error?.lineNumber,
      serverName: error?.serverName,
      originalError: error?.originalError?.message
    })

    if (error?.number === 547) {
      res.status(400).json({ message: 'OrderId, OwnerCompanyId, or CreatedBy does not exist' })
      return
    }

    if (error.message === 'INVALID_COMPRESSED_DATA') {
      res.status(400).json({ message: 'Failed to decompress 3D file — upload may be corrupted' })
      return
    }

    res.status(500).json({
      message: 'Server error while uploading asset',
      error: error.message,
      detail: error.originalError?.message // MS SQL specific detail
    })
  }
}

export const listMyAssetsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const assets = await listMyAssets(req.user.userId)

    res.status(200).json({
      message: 'Get my assets successfully',
      data: assets
    })
  } catch (error) {
    console.error('Error in listMyAssetsHandler:', error)
    res.status(500).json({ message: 'Server error while getting my assets' })
  }
}

export const listAllAssetsHandler = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assets = await listAllAssets()
    res.status(200).json({ message: 'Get all assets successfully', data: assets })
  } catch (error) {
    console.error('Error in listAllAssetsHandler:', error)
    res.status(500).json({ message: 'Server error while getting all assets' })
  }
}

export const updateAssetHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (typeof req.params.id !== 'string') {
      res.status(400).json({ message: 'Asset ID must be a string' })
      return
    }
    const assetId = parseAssetId(req.params.id)

    if (!assetId) {
      res.status(400).json({ message: 'Asset ID is invalid' })
      return
    }

    const { OrderId, AssetName, Description, PreviewImage, OwnerCompanyId, AssetType, Price, IsMarketplace, Category, Industry, Base64Data, UploadId } =
      req.body

    if (OrderId !== undefined && parseOptionalInt(OrderId) === undefined) {
      res.status(400).json({ message: 'OrderId must be a positive integer or null' })
      return
    }

    if (AssetName !== undefined && (typeof AssetName !== 'string' || AssetName.trim() === '')) {
      res.status(400).json({ message: 'AssetName must be a non-empty string' })
      return
    }

    const parsedDescription = parseOptionalString(Description)
    if (Description !== undefined && parsedDescription === undefined) {
      res.status(400).json({ message: 'Description must be a string or null' })
      return
    }

    const parsedPreviewImage = parseOptionalString(PreviewImage)
    if (PreviewImage !== undefined && parsedPreviewImage === undefined) {
      res.status(400).json({ message: 'PreviewImage must be a string or null' })
      return
    }

    if (OwnerCompanyId !== undefined && parseOptionalInt(OwnerCompanyId) === undefined) {
      res.status(400).json({ message: 'OwnerCompanyId must be a positive integer or null' })
      return
    }

    const parsedAssetType = parseOptionalAssetType(AssetType)
    if (AssetType !== undefined && parsedAssetType === undefined) {
      res.status(400).json({ message: `AssetType must be one of: ${ALLOWED_ASSET_TYPES.join(', ')} or null` })
      return
    }

    const parsedPrice = parseOptionalNumber(Price)
    if (Price !== undefined && parsedPrice === undefined) {
      res.status(400).json({ message: 'Price must be a number greater than or equal to 0 or null' })
      return
    }

    const parsedIsMarketplace = parseOptionalBoolean(IsMarketplace)
    if (IsMarketplace !== undefined && parsedIsMarketplace === undefined) {
      res.status(400).json({ message: 'IsMarketplace must be a boolean' })
      return
    }

    const parsedCategory = parseOptionalString(Category)
    if (Category !== undefined && parsedCategory === undefined) {
      res.status(400).json({ message: 'Category must be a string or null' })
      return
    }

    const parsedIndustry = parseOptionalString(Industry)
    if (Industry !== undefined && parsedIndustry === undefined) {
      res.status(400).json({ message: 'Industry must be a string or null' })
      return
    }

    let parsedBase64Data = parseOptionalString(Base64Data)
    if (Base64Data !== undefined && parsedBase64Data === undefined) {
      res.status(400).json({ message: 'Base64Data must be a string or null' })
      return
    }

    try {
      parsedBase64Data = resolveUploadedBase64(parsedBase64Data, UploadId)
    } catch (err: any) {
      if (err.message === 'INVALID_UPLOAD_ID') {
        res.status(400).json({ message: 'UploadId must be a string' })
        return
      }
      if (err.message === 'UPLOADED_FILE_NOT_FOUND') {
        res.status(400).json({ message: 'Assembled upload not found. The upload session may have timed out or failed.' })
        return
      }
      throw err
    }

    // Decompress if the FE sent a gzip-compressed payload
    const finalBase64Data = decompressBase64(parsedBase64Data)

    const asset = await updateAsset(assetId, {
      OrderId: parseOptionalInt(OrderId),
      AssetName: typeof AssetName === 'string' ? AssetName.trim() : undefined,
      Description: parsedDescription,
      PreviewImage: parsedPreviewImage,
      OwnerCompanyId: parseOptionalInt(OwnerCompanyId),
      AssetType: parsedAssetType,
      Price: parsedPrice,
      IsMarketplace: parsedIsMarketplace,
      Category: parsedCategory,
      Industry: parsedIndustry,
      Base64Data: finalBase64Data
    })

    res.status(200).json({
      message: 'Update asset successfully',
      data: asset
    })
  } catch (error: any) {
    console.error('Error in updateAssetHandler:', error)

    if (error.message === 'NO_UPDATE_FIELDS') {
      res.status(400).json({ message: 'At least one field is required for update' })
      return
    }

    if (error.message === 'ASSET_NOT_FOUND') {
      res.status(404).json({ message: 'Asset not found' })
      return
    }

    if (error?.number === 547) {
      res.status(400).json({ message: 'OrderId or OwnerCompanyId does not exist' })
      return
    }

    res.status(500).json({ message: 'Server error while updating asset' })
  }
}

export const deleteAssetHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (typeof req.params.id !== 'string') {
      res.status(400).json({ message: 'Asset ID must be a string' })
      return
    }
    const assetId = parseAssetId(req.params.id)

    if (!assetId) {
      res.status(400).json({ message: 'Asset ID is invalid' })
      return
    }

    await deleteAsset(assetId)

    res.status(200).json({
      message: 'Delete asset successfully'
    })
  } catch (error: any) {
    console.error('Error in deleteAssetHandler:', error)

    if (error.message === 'ASSET_NOT_FOUND') {
      res.status(404).json({ message: 'Asset not found' })
      return
    }

    res.status(500).json({ message: 'Server error while deleting asset' })
  }
}

export const getAssetByIdHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (typeof req.params.id !== 'string') {
      res.status(400).json({ message: 'Asset ID must be a string' })
      return
    }
    const assetId = parseAssetId(req.params.id)

    if (!assetId) {
      res.status(400).json({ message: 'Asset ID is invalid' })
      return
    }

    const asset = await getAssetById(assetId)

    if (!asset) {
      res.status(404).json({ message: 'Asset not found' })
      return
    }

    res.status(200).json({
      message: 'Get asset detail successfully',
      data: asset
    })
  } catch (error) {
    console.error('Error in getAssetByIdHandler:', error)
    res.status(500).json({ message: 'Server error while getting asset detail' })
  }
}

export const listMarketplaceAssetsHandler = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assets = await listMarketplaceAssets()

    res.status(200).json({
      message: 'Get marketplace assets successfully',
      data: assets
    })
  } catch (error) {
    console.error('Error in listMarketplaceAssetsHandler:', error)
    res.status(500).json({ message: 'Server error while getting marketplace assets' })
  }
}

export const submitAssetHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (typeof req.params.id !== 'string') {
      res.status(400).json({ message: 'Asset ID must be a string' })
      return
    }
    const assetId = parseAssetId(req.params.id)

    if (!assetId) {
      res.status(400).json({ message: 'Asset ID is invalid' })
      return
    }

    const asset = await submitAssetForPublish(assetId)

    res.status(200).json({
      message: 'Submit asset for publish successfully',
      data: asset
    })
  } catch (error: any) {
    console.error('Error in submitAssetHandler:', error)

    if (error.message === 'ASSET_NOT_FOUND') {
      res.status(404).json({ message: 'Asset not found' })
      return
    }

    if (error.message === 'ASSET_CANNOT_SUBMIT') {
      res.status(400).json({ message: 'Only draft assets can be submitted' })
      return
    }

    res.status(500).json({ message: 'Server error while submitting asset' })
  }
}

export const approveAssetHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (typeof req.params.id !== 'string') {
      res.status(400).json({ message: 'Asset ID must be a string' })
      return
    }
    const assetId = parseAssetId(req.params.id)

    if (!assetId) {
      res.status(400).json({ message: 'Asset ID is invalid' })
      return
    }

    const asset = await approveAsset(assetId)

    res.status(200).json({
      message: 'Approve asset successfully',
      data: asset
    })
  } catch (error: any) {
    console.error('Error in approveAssetHandler:', error)

    if (error.message === 'ASSET_NOT_FOUND') {
      res.status(404).json({ message: 'Asset not found' })
      return
    }

    if (error.message === 'ASSET_CANNOT_APPROVE') {
      res.status(400).json({ message: 'Only pending assets can be approved' })
      return
    }

    res.status(500).json({ message: 'Server error while approving asset' })
  }
}

export const assetController = {
  create: createAssetHandler,
  update: updateAssetHandler,
  delete: deleteAssetHandler,
  getById: getAssetByIdHandler,
  listAll: listAllAssetsHandler,
  listMarketplace: listMarketplaceAssetsHandler,
  listMy: listMyAssetsHandler,
  submit: submitAssetHandler,
  approve: approveAssetHandler,
  uploadChunk: uploadChunkHandler
}

export default assetController
