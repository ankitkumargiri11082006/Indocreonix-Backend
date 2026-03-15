import { Router } from 'express'
import { getDashboardStats } from '../controllers/dashboardController.js'
import { permit, protect } from '../middlewares/auth.js'

const router = Router()

router.get('/stats', protect, permit('admin', 'editor'), getDashboardStats)

export default router
