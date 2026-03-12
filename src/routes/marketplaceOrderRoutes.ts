import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { marketplaceOrderController } from '../controllers/marketplaceOrderController'

const router = Router()

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER']), marketplaceOrderController.create)
router.get('/my', authenticate, authorize(['ADMIN', 'CUSTOMER']), marketplaceOrderController.listMy)
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER']), marketplaceOrderController.getById)
router.put('/:id/refund', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER']), marketplaceOrderController.refund)

export default router
