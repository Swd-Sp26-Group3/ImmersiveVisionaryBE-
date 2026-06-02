import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { orderController } from '../controllers/orderController'

const router = Router()

router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), orderController.getAttachmentById)
router.delete('/:id', authenticate, authorize(['ADMIN', 'ARTIST']), orderController.deleteAttachment)

export default router
