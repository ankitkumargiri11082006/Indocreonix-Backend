import { Router } from 'express'
import {
	createProjectOrder,
	deleteProjectOrder,
	deleteProjectOrderPrd,
	deleteProjectOrderSupportingDocument,
	getProjectOrderById,
	getProjectOrders,
	updateProjectOrder,
} from '../controllers/orderController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'
import { uploadOrderDocuments } from '../middlewares/upload.js'

const router = Router()

router.post('/', uploadOrderDocuments, createProjectOrder)
router.get('/', protect, permit('admin', 'editor'), requirePermission('orders'), getProjectOrders)
router.get('/:id', protect, permit('admin', 'editor'), requirePermission('orders'), getProjectOrderById)
router.patch('/:id', protect, permit('admin', 'editor'), requirePermission('orders'), updateProjectOrder)
router.delete('/:id', protect, permit('admin', 'editor'), requirePermission('orders'), deleteProjectOrder)
router.delete(
	'/:id/prd',
	protect,
	permit('admin', 'editor'),
	requirePermission('orders'),
	deleteProjectOrderPrd
)
router.delete(
	'/:id/supporting/:documentId',
	protect,
	permit('admin', 'editor'),
	requirePermission('orders'),
	deleteProjectOrderSupportingDocument
)

export default router
