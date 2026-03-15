import { Router } from 'express'
import {
  listPublicClients,
  listAdminClients,
  createClient,
  updateClient,
  deleteClient,
} from '../controllers/catalogController.js'
import { permit, protect } from '../middlewares/auth.js'

const router = Router()

router.get('/public', listPublicClients)
router.get('/', protect, permit('admin', 'editor'), listAdminClients)
router.post('/', protect, permit('admin', 'editor'), createClient)
router.put('/:id', protect, permit('admin', 'editor'), updateClient)
router.delete('/:id', protect, permit('admin'), deleteClient)

export default router
