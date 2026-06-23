import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { paymentController } from '../controllers/paymentController'

const router = Router()

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER', 'ARTIST']), paymentController.create)

// Bảo mật: Chỉ cho phép ADMIN/MANAGER xác nhận thanh toán thủ công.
router.post('/confirm', authenticate, authorize(['ADMIN', 'MANAGER']), paymentController.confirm)



router.get('/', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER', 'ARTIST']), paymentController.list)
router.post('/sepay-webhook', paymentController.sepayWebhook)
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER', 'ARTIST']), paymentController.getById)

export default router

