import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { assetVersionController } from '../controllers/assetVersionController'

const router = Router()

// POST   /api/asset-versions/:assetId             → upload new version
router.post('/:assetId', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), assetVersionController.upload)

// GET    /api/asset-versions/:assetId             → list all versions of an asset
router.get('/:assetId', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), assetVersionController.getVersions)

// GET    /api/asset-versions/:id/download         → download a specific version
router.get('/:id/download', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), assetVersionController.download)

// DELETE /api/asset-versions/:id                  → delete a specific version
router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), assetVersionController.delete)

// PUT    /api/asset-versions/:id/activate/:assetId → set version as active on the asset
router.put('/:id/activate/:assetId', authenticate, authorize(['ADMIN', 'MANAGER']), assetVersionController.activate)

export default router
