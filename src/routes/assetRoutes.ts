import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { assetController } from '../controllers/assetController'

const router = Router()

router.get('/marketplace', assetController.listMarketplace)
router.get('/my', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), assetController.listMy)
router.get('/', authenticate, authorize(['ADMIN', 'MANAGER']), assetController.listAll)
router.post('/', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), assetController.create)
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), assetController.getById)
router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), assetController.update)
router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), assetController.delete)
router.put('/:id/submit', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), assetController.submit)
router.put('/:id/approve', authenticate, authorize(['ADMIN']), assetController.approve)

export default router
