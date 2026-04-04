import { Router } from 'express'
import { getAnalyticsOverview, getDashboardStats, getSectionIndicators } from '../controllers/dashboardController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'

const router = Router()

router.get('/stats', protect, permit('admin', 'editor'), requirePermission('dashboard'), getDashboardStats)
router.get('/indicators', protect, permit('admin', 'editor'), getSectionIndicators)
router.get('/analytics', protect, permit('admin', 'editor'), requirePermission('analytics'), getAnalyticsOverview)

export default router
