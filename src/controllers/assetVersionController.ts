import type { Response } from 'express'
import type { AuthRequest } from '../middlewares/authMiddleware'
import { decompressBase64 } from './assetController'
import {
  createAssetVersion,
  getAssetVersions,
  getAssetVersionById,
  deleteAssetVersion,
  activateAssetVersion,
  type FileFormat
} from '../services/assetVersionService'

const ALLOWED_FILE_FORMATS: FileFormat[] = ['GLB', 'USDZ', 'FBX', 'WEBAR', 'OBJ']

const parseId = (idParam: string): number | null => {
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return null
  }
  return id
}

export const uploadVersionHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (typeof req.params.assetId !== 'string') {
      res.status(400).json({ message: 'Asset ID must be a string' })
      return
    }
    const assetId = parseId(req.params.assetId)
    if (!assetId) {
      res.status(400).json({ message: 'Asset ID is invalid' })
      return
    }

    const { FileFormat, FileUrl, Base64Data, PolyCount, TextureSize } = req.body

    if (!FileFormat || !ALLOWED_FILE_FORMATS.includes(FileFormat as FileFormat)) {
      res.status(400).json({ message: `FileFormat is required and must be one of: ${ALLOWED_FILE_FORMATS.join(', ')}` })
      return
    }

    if (FileUrl !== undefined && FileUrl !== null && typeof FileUrl !== 'string') {
      res.status(400).json({ message: 'FileUrl must be a string or null' })
      return
    }

    if (Base64Data !== undefined && Base64Data !== null && typeof Base64Data !== 'string') {
      res.status(400).json({ message: 'Base64Data must be a string or null' })
      return
    }

    if (PolyCount !== undefined && PolyCount !== null && (!Number.isInteger(PolyCount) || PolyCount < 0)) {
      res.status(400).json({ message: 'PolyCount must be a non-negative integer or null' })
      return
    }

    if (TextureSize !== undefined && TextureSize !== null && typeof TextureSize !== 'string') {
      res.status(400).json({ message: 'TextureSize must be a string or null' })
      return
    }

    const decompressedBase64 = decompressBase64(Base64Data)

    const version = await createAssetVersion(assetId, {
      FileFormat: FileFormat as FileFormat,
      FileUrl: FileUrl ?? null,
      Base64Data: decompressedBase64 ?? null,
      PolyCount: PolyCount ?? null,
      TextureSize: TextureSize ?? null
    })

    res.status(201).json({
      message: 'Upload version successfully',
      data: version
    })
  } catch (error: any) {
    console.error('Error in uploadVersionHandler:', error)

    if (error?.number === 547) {
      // 547 = FK violation (asset not found) OR CHECK constraint violation (invalid FileFormat)
      const detail = error?.originalError?.message ?? error?.message ?? '';
      const isCheckConstraint = detail.includes('CHECK constraint') || detail.includes('CK_');
      res.status(400).json({
        message: isCheckConstraint
          ? `Invalid FileFormat value. Allowed: ${ALLOWED_FILE_FORMATS.join(', ')}`
          : 'Asset does not exist',
        detail
      })
      return
    }

    res.status(500).json({
      message: 'Server error while uploading version',
      error: error?.message,
      detail: error?.originalError?.message
    })
  }
}

export const getVersionsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (typeof req.params.assetId !== 'string') {
      res.status(400).json({ message: 'Asset ID must be a string' })
      return
    }
    const assetId = parseId(req.params.assetId)
    if (!assetId) {
      res.status(400).json({ message: 'Asset ID is invalid' })
      return
    }

    const versions = await getAssetVersions(assetId)

    res.status(200).json({
      message: 'Get asset versions successfully',
      data: versions
    })
  } catch (error) {
    console.error('Error in getVersionsHandler:', error)
    res.status(500).json({ message: 'Server error while getting asset versions' })
  }
}

export const downloadVersionHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (typeof req.params.id !== 'string') {
      res.status(400).json({ message: 'Version ID must be a string' })
      return
    }
    const versionId = parseId(req.params.id)
    if (!versionId) {
      res.status(400).json({ message: 'Version ID is invalid' })
      return
    }

    const version = await getAssetVersionById(versionId)

    if (!version) {
      res.status(404).json({ message: 'Version not found' })
      return
    }

    if (!version.FileUrl) {
      res.status(404).json({ message: 'File URL not available for this version' })
      return
    }

    res.status(200).json({
      message: 'Get download link successfully',
      data: { downloadUrl: version.FileUrl }
    })
  } catch (error) {
    console.error('Error in downloadVersionHandler:', error)
    res.status(500).json({ message: 'Server error while getting download link' })
  }
}

export const deleteVersionHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const versionId = parseId(req.params.id)
    if (!versionId) { res.status(400).json({ message: 'Version ID is invalid' }); return }
    const deleted = await deleteAssetVersion(versionId)
    if (!deleted) { res.status(404).json({ message: 'Version not found' }); return }
    res.status(200).json({ message: 'Version deleted successfully' })
  } catch (error) {
    console.error('Error in deleteVersionHandler:', error)
    res.status(500).json({ message: 'Server error while deleting version' })
  }
}

export const activateVersionHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const versionId = parseId(req.params.id)
    const assetId = parseId(req.params.assetId)
    if (!versionId || !assetId) { res.status(400).json({ message: 'Invalid ID' }); return }
    const ok = await activateAssetVersion(versionId, assetId)
    if (!ok) { res.status(404).json({ message: 'Version or asset not found' }); return }
    res.status(200).json({ message: 'Version activated successfully' })
  } catch (error) {
    console.error('Error in activateVersionHandler:', error)
    res.status(500).json({ message: 'Server error while activating version' })
  }
}

export const assetVersionController = {
  upload: uploadVersionHandler,
  getVersions: getVersionsHandler,
  download: downloadVersionHandler,
  delete: deleteVersionHandler,
  activate: activateVersionHandler,
}

export default assetVersionController
