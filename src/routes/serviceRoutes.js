import { Router } from 'express'
import {
  listPublicServices,
  listAdminServices,
  createService,
  updateService,
  deleteService,
} from '../controllers/catalogController.js'
import { permit, protect } from '../middlewares/auth.js'

const router = Router()

router.get('/public', listPublicServices)
router.get('/', protect, permit('admin', 'editor'), listAdminServices)
router.post('/', protect, permit('admin', 'editor'), createService)
router.put('/:id', protect, permit('admin', 'editor'), updateService)
router.delete('/:id', protect, permit('admin'), deleteService)

export default router
