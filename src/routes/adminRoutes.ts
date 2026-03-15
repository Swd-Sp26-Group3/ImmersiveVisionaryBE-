import { Router } from 'express'
import { adminController } from '../controllers/adminController'
import { authenticate, authorize } from '../middlewares/authMiddleware'

const router = Router()

// All admin routes require authentication and admin role
router.use(authenticate)
router.use(authorize(['ADMIN']))

// Dashboard
router.get('/dashboard', authenticate, adminController.getDashboardStats)
router.post('/users', adminController.createUser)
router.put('/users/:id/role', adminController.updateUserRole)


export { router as adminRoutes }
