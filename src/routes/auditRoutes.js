import { Router } from 'express'
import { getAuditLogs } from '../controllers/auditController.js'
import { permit, protect } from '../middlewares/auth.js'

const router = Router()

router.get('/', protect, permit('admin'), getAuditLogs)

export default router
