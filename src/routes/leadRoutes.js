import { Router } from 'express'
import { createLead, getLeads, updateLead } from '../controllers/leadController.js'
import { permit, protect } from '../middlewares/auth.js'

const router = Router()

router.post('/', createLead)
router.get('/', protect, permit('admin', 'editor'), getLeads)
router.patch('/:id', protect, permit('admin', 'editor'), updateLead)

export default router
