import { Router } from 'express'
import {
  listPublicServices,
  listAdminServices,
  createService,
  updateService,
  deleteService,
} from '../controllers/catalogController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'

const router = Router()

router.get('/public', listPublicServices)
router.get('/', protect, permit('admin', 'editor'), requirePermission('services'), listAdminServices)
router.post('/', protect, permit('admin', 'editor'), requirePermission('services'), createService)
router.put('/:id', protect, permit('admin', 'editor'), requirePermission('services'), updateService)
router.delete('/:id', protect, permit('admin'), requirePermission('services'), deleteService)

export default router
