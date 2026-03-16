import { Router } from 'express'
import { createLead, deleteLead, getLeads, updateLead } from '../controllers/leadController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'

const router = Router()

router.post('/', createLead)
router.get('/', protect, permit('admin', 'editor'), requirePermission('leads'), getLeads)
router.patch('/:id', protect, permit('admin', 'editor'), requirePermission('leads'), updateLead)
router.delete('/:id', protect, permit('admin', 'editor'), requirePermission('leads'), deleteLead)

export default router
