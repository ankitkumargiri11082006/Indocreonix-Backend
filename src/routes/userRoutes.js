import { Router } from 'express'
import { getUsers, updateUserRole } from '../controllers/userController.js'
import { permit, protect } from '../middlewares/auth.js'

const router = Router()

router.get('/', protect, permit('admin'), getUsers)
router.patch('/:id', protect, permit('admin'), updateUserRole)

export default router
