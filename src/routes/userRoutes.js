import { Router } from 'express'
import { getUsers, updateMyAvatar, updateUserRole } from '../controllers/userController.js'
import { permit, protect } from '../middlewares/auth.js'
import { uploadAvatarImage } from '../middlewares/upload.js'

const router = Router()

router.get('/', protect, permit('admin'), getUsers)
router.patch('/me/avatar', protect, uploadAvatarImage.single('avatar'), updateMyAvatar)
router.patch('/:id', protect, permit('admin'), updateUserRole)

export default router
