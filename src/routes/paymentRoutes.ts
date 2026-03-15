import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { paymentController } from '../controllers/paymentController'

const router = Router()

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER', 'ARTIST']), paymentController.create)
router.post('/confirm', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER', 'ARTIST']), paymentController.confirm)
router.get('/', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER', 'ARTIST']), paymentController.list)
router.post('/create-vnpay-url', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER', 'ARTIST']), paymentController.createVnpayUrl)
router.get('/vnpay-return', paymentController.vnpayReturn)
router.get('/vnpay-ipn', paymentController.vnpayIpn)
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER', 'ARTIST']), paymentController.getById)

export default router
