import { Router } from 'express'
import { deleteAuditLog, deleteAuditLogsBulk, getAuditLogs } from '../controllers/auditController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'

const router = Router()

router.get('/', protect, permit('admin'), requirePermission('auditLogs'), getAuditLogs)
router.delete('/cleanup', protect, permit('admin'), requirePermission('auditLogs'), deleteAuditLogsBulk)
router.delete('/:id', protect, permit('admin'), requirePermission('auditLogs'), deleteAuditLog)

export default router
