import { Router } from 'express'
import multer from 'multer'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { assetController } from '../controllers/assetController'

const router = Router()
const upload = multer()

const noCache = (req: any, res: any, next: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  next()
}

router.get('/marketplace', noCache, assetController.listMarketplace)
router.get('/my', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), noCache, assetController.listMy)
router.get('/', authenticate, authorize(['ADMIN', 'MANAGER']), noCache, assetController.listAll)
router.post('/', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), assetController.create)
router.post('/upload-chunk', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), upload.single('chunk'), assetController.uploadChunk)
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST', 'CUSTOMER']), noCache, assetController.getById)
router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), assetController.update)
router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), assetController.delete)
router.put('/:id/submit', authenticate, authorize(['ADMIN', 'MANAGER', 'ARTIST']), assetController.submit)
router.put('/:id/approve', authenticate, authorize(['ADMIN', 'MANAGER']), assetController.approve)

export default router
