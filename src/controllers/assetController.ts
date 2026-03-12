import type { Response } from 'express'
import type { AuthRequest } from '../middlewares/authMiddleware'
import {
  approveAsset,
  createAsset,
  deleteAsset,
  getAssetById,
  listMarketplaceAssets,
  submitAssetForPublish,
  updateAsset,
  type AssetType
} from '../services/assetService'

const ALLOWED_ASSET_TYPES: AssetType[] = ['ORDER', 'MARKETPLACE', 'TEMPLATE']

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

    const { OrderId, AssetName, PreviewImage, OwnerCompanyId, AssetType, Price, IsMarketplace, Category, Industry } =
      req.body

    if (OrderId !== undefined && parseOptionalInt(OrderId) === undefined) {
      res.status(400).json({ message: 'OrderId must be a positive integer or null' })
      return
    }

    if (!AssetName || typeof AssetName !== 'string' || AssetName.trim() === '') {
      res.status(400).json({ message: 'AssetName is required' })
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

    const asset = await createAsset(req.user.userId, {
      OrderId: parseOptionalInt(OrderId),
      AssetName: AssetName.trim(),
      PreviewImage: parsedPreviewImage,
      OwnerCompanyId: parseOptionalInt(OwnerCompanyId),
      AssetType: parsedAssetType,
      Price: parsedPrice,
      IsMarketplace: parsedIsMarketplace,
      Category: parsedCategory,
      Industry: parsedIndustry
    })

    res.status(201).json({
      message: 'Upload asset successfully',
      data: asset
    })
  } catch (error: any) {
    console.error('Error in createAssetHandler:', error)

    if (error?.number === 547) {
      res.status(400).json({ message: 'OrderId, OwnerCompanyId, or CreatedBy does not exist' })
      return
    }

    res.status(500).json({ message: 'Server error while uploading asset' })
  }
}

export const updateAssetHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assetId = parseAssetId(req.params.id)

    if (!assetId) {
      res.status(400).json({ message: 'Asset ID is invalid' })
      return
    }

    const { OrderId, AssetName, PreviewImage, OwnerCompanyId, AssetType, Price, IsMarketplace, Category, Industry } =
      req.body

    if (OrderId !== undefined && parseOptionalInt(OrderId) === undefined) {
      res.status(400).json({ message: 'OrderId must be a positive integer or null' })
      return
    }

    if (AssetName !== undefined && (typeof AssetName !== 'string' || AssetName.trim() === '')) {
      res.status(400).json({ message: 'AssetName must be a non-empty string' })
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

    const asset = await updateAsset(assetId, {
      OrderId: parseOptionalInt(OrderId),
      AssetName: typeof AssetName === 'string' ? AssetName.trim() : undefined,
      PreviewImage: parsedPreviewImage,
      OwnerCompanyId: parseOptionalInt(OwnerCompanyId),
      AssetType: parsedAssetType,
      Price: parsedPrice,
      IsMarketplace: parsedIsMarketplace,
      Category: parsedCategory,
      Industry: parsedIndustry
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
  listMarketplace: listMarketplaceAssetsHandler,
  submit: submitAssetHandler,
  approve: approveAssetHandler
}

export default assetController
