import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { packageController } from '../controllers/packageController'

const router = Router()

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), packageController.create)
router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), packageController.update)
router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), packageController.delete)
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), packageController.getById)
router.get('/', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), packageController.list)

export default router
