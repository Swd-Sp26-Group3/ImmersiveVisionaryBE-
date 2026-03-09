import { Router } from 'express'
import {
	getProfileHandler,
	updateProfileHandler,
	getUserByIdHandler
} from '../controllers/userController'
import { authenticate } from '../middlewares/authMiddleware'

const router = Router()

// GET /users/profile
router.get('/profile', authenticate, getProfileHandler)

// PUT /users/profile
router.put('/profile', authenticate, updateProfileHandler)

// GET /users/:id
router.get('/:id', authenticate, getUserByIdHandler)

export default router
