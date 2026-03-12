import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { paymentController } from '../controllers/paymentController'

const router = Router()

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER']), paymentController.create)
router.post('/confirm', authenticate, authorize(['ADMIN', 'MANAGER']), paymentController.confirm)
router.get('/', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER']), paymentController.list)
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER']), paymentController.getById)

export default router
