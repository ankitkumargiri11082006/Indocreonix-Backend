import { Router } from 'express'
import {
  listPublicClients,
  listAdminClients,
  createClient,
  updateClient,
  deleteClient,
} from '../controllers/catalogController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'

const router = Router()

router.get('/public', listPublicClients)
router.get('/', protect, permit('admin', 'editor'), requirePermission('clients'), listAdminClients)
router.post('/', protect, permit('admin', 'editor'), requirePermission('clients'), createClient)
router.put('/:id', protect, permit('admin', 'editor'), requirePermission('clients'), updateClient)
router.delete('/:id', protect, permit('admin'), requirePermission('clients'), deleteClient)

export default router
