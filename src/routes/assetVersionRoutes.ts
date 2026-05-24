import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { assetVersionController } from '../controllers/assetVersionController'

const router = Router()

// POST   /api/asset-versions/:assetId      → upload new version for an asset
router.post('/:assetId', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), assetVersionController.upload)

// GET    /api/asset-versions/:assetId      → list all versions of an asset
router.get('/:assetId', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), assetVersionController.getVersions)

// GET    /api/asset-versions/:id/download  → download a specific version by versionId
router.get('/:id/download', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), assetVersionController.download)

export default router
