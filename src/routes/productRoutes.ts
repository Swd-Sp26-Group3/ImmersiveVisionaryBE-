import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { productController } from '../controllers/productController'

const router = Router()

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER', 'SELLER']), productController.create)
router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'SELLER']), productController.update)
router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'SELLER']), productController.delete)
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER', 'SELLER']), productController.getById)
router.get('/', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER', 'SELLER']), productController.list)

export default router
