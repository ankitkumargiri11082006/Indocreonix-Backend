import { Router } from 'express'
import { getDashboardStats } from '../controllers/dashboardController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'

const router = Router()

router.get('/stats', protect, permit('admin', 'editor'), requirePermission('dashboard'), getDashboardStats)

export default router
