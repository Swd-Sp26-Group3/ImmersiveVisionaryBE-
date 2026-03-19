import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { orderController } from '../controllers/orderController'

const router = Router()

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), orderController.create)
router.get('/my', authenticate, authorize(['ADMIN', 'ARTIST', 'CUSTOMER']), orderController.listMy)
router.get('/', authenticate, authorize(['ADMIN', 'MANAGER']), orderController.list)
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), orderController.getById)
router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), orderController.update)
router.put('/:id/status', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), orderController.updateStatus)
router.put('/:id/cancel', authenticate, authorize(['ADMIN', 'CUSTOMER']), orderController.cancel)

router.get('/:id/attachments', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), orderController.getAttachments)
router.post('/:id/attachments', authenticate, authorize(['ADMIN', 'ARTIST']), orderController.addAttachment)

export default router
