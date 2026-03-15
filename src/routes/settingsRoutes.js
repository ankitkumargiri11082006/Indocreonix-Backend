import { Router } from 'express'
import { getSettings, updateSettings } from '../controllers/settingsController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'

const router = Router()

router.get('/', getSettings)
router.put('/', protect, permit('admin'), requirePermission('settings'), updateSettings)

export default router
