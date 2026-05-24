import { Router } from 'express'
import { userController } from '../controllers/userController'
import { authenticate, authorize } from '../middlewares/authMiddleware'

const router = Router()

router.get('/profile', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), userController.getProfile)
router.put('/profile', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), userController.updateProfile)

router.get('/', authenticate, authorize(['ADMIN', 'MANAGER']), userController.getAll)

router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), userController.getById)

router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), userController.update)

router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), userController.delete)

router.post('/:id/approve', authenticate, authorize(['ADMIN', 'MANAGER']), userController.approve)

router.put('/:id/role', authenticate, authorize(['ADMIN']), userController.updateRole)

export default router
