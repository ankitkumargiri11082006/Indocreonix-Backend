import { Router } from 'express'
import { deleteMedia, getMedia, uploadMedia } from '../controllers/mediaController.js'
import { permit, protect } from '../middlewares/auth.js'
import { upload } from '../middlewares/upload.js'

const router = Router()

router.get('/', protect, permit('admin', 'editor'), getMedia)
router.post('/', protect, permit('admin', 'editor'), upload.single('file'), uploadMedia)
router.delete('/:id', protect, permit('admin'), deleteMedia)

export default router
