import { Router } from 'express'
import { deleteMedia, getMedia, uploadMedia } from '../controllers/mediaController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'
import { upload } from '../middlewares/upload.js'

const router = Router()

router.get('/', protect, permit('admin', 'editor'), requirePermission('media'), getMedia)
router.post('/', protect, permit('admin', 'editor'), requirePermission('media'), upload.single('file'), uploadMedia)
router.delete('/:id', protect, permit('admin'), requirePermission('media'), deleteMedia)

export default router
