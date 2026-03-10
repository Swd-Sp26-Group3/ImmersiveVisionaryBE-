import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { companyController } from '../controllers/companyController'

const router = Router()

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), companyController.create)
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'SELLER']), companyController.getById)
router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), companyController.update)
router.get('/', authenticate, authorize(['ADMIN', 'MANAGER', 'SELLER']), companyController.list)

export default router
