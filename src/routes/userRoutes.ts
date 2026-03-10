import { Router } from 'express'
import { userController } from '../controllers/userController'
import { authenticate, authorize } from '../middlewares/authMiddleware'

const router = Router()

router.get('/profile', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER', 'SELLER']), userController.getProfile)

router.put('/profile', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER', 'SELLER']), userController.updateProfile)

router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), userController.getById)

export default router
