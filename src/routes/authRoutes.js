import { Router } from 'express'
import { changePassword, login, me } from '../controllers/authController.js'
import { protect } from '../middlewares/auth.js'

const router = Router()

router.post('/login', login)
router.get('/me', protect, me)
router.patch('/change-password', protect, changePassword)

export default router
