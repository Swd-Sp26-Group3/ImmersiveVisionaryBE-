import { Router } from 'express'
import { adminController } from '../controllers/adminController'
import { authenticate, authorize } from '../middlewares/authMiddleware'

const router = Router()

// All admin routes require authentication and admin role
router.use(authenticate)
router.use(authorize(['Admin']))

// Dashboard
router.get('/dashboard', authenticate, adminController.getDashboardStats)

// User Management

export { router as adminRoutes }
