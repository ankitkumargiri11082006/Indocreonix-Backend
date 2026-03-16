import { Router } from 'express'
import { createProjectOrder, getProjectOrders, updateProjectOrder } from '../controllers/orderController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'
import { uploadOrderDocuments } from '../middlewares/upload.js'

const router = Router()

router.post('/', uploadOrderDocuments, createProjectOrder)
router.get('/', protect, permit('admin', 'editor'), requirePermission('orders'), getProjectOrders)
router.patch('/:id', protect, permit('admin', 'editor'), requirePermission('orders'), updateProjectOrder)

export default router
