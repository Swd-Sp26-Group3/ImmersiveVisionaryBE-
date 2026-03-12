import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { orderController } from '../controllers/orderController'

const router = Router()

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), orderController.create)
router.get('/my', authenticate, authorize(['ADMIN', 'CUSTOMER']), orderController.listMy)
router.get('/', authenticate, authorize(['ADMIN', 'MANAGER']), orderController.list)
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'CUSTOMER']), orderController.getById)
router.put('/:id/status', authenticate, authorize(['ADMIN', 'MANAGER']), orderController.updateStatus)
router.put('/:id/cancel', authenticate, authorize(['ADMIN', 'CUSTOMER']), orderController.cancel)

export default router
