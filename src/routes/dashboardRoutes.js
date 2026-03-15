import { Router } from 'express'
import { getDashboardStats, getSectionIndicators } from '../controllers/dashboardController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'

const router = Router()

router.get('/stats', protect, permit('admin', 'editor'), requirePermission('dashboard'), getDashboardStats)
router.get('/indicators', protect, permit('admin', 'editor'), getSectionIndicators)

export default router
