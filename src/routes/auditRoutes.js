import { Router } from 'express'
import { getAuditLogs } from '../controllers/auditController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'

const router = Router()

router.get('/', protect, permit('admin'), requirePermission('auditLogs'), getAuditLogs)

export default router
