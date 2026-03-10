import { Router } from 'express'
import {

  loginHandler,
  logoutHandler,
  PasswordChangeHandler,
  refreshAccessTokenHandler,
  registerHandler

} from '../controllers/authController'
import { authenticate, authorize } from '../middlewares/authMiddleware'

const router = Router()

// Public routes
router.post('/register', registerHandler)
router.post('/login', loginHandler)
router.post('/refresh-token', refreshAccessTokenHandler)
router.delete('/logout', authenticate, logoutHandler)
router.put('/change-password', authenticate, PasswordChangeHandler)


export default router

