import { Router } from 'express'
import {
  listPublicProjects,
  listAdminProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/catalogController.js'
import { permit, protect } from '../middlewares/auth.js'

const router = Router()

router.get('/public', listPublicProjects)
router.get('/', protect, permit('admin', 'editor'), listAdminProjects)
router.post('/', protect, permit('admin', 'editor'), createProject)
router.put('/:id', protect, permit('admin', 'editor'), updateProject)
router.delete('/:id', protect, permit('admin'), deleteProject)

export default router
