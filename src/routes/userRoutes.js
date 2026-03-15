import { Router } from 'express'
import { getUsers, updateAdminPermissions, updateMyAvatar, updateUserRole } from '../controllers/userController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'
import { uploadAvatarImage } from '../middlewares/upload.js'

const router = Router()

router.get('/', protect, permit('superadmin', 'admin'), requirePermission('users'), getUsers)
router.patch('/me/avatar', protect, requirePermission('profile'), uploadAvatarImage.single('avatar'), updateMyAvatar)
router.patch('/:id', protect, permit('superadmin'), requirePermission('users'), updateUserRole)
router.patch('/:id/permissions', protect, permit('superadmin'), requirePermission('users'), updateAdminPermissions)

export default router
