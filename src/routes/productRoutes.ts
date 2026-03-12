import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { productController } from '../controllers/productController'

const router = Router()

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), productController.create)
router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), productController.update)
router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), productController.delete)
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), productController.getById)
router.get('/', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), productController.list)

export default router
