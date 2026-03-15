import { Router } from 'express'
import {
  listPublicProjects,
  listAdminProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/catalogController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'

const router = Router()

router.get('/public', listPublicProjects)
router.get('/', protect, permit('admin', 'editor'), requirePermission('projects'), listAdminProjects)
router.post('/', protect, permit('admin', 'editor'), requirePermission('projects'), createProject)
router.put('/:id', protect, permit('admin', 'editor'), requirePermission('projects'), updateProject)
router.delete('/:id', protect, permit('admin'), requirePermission('projects'), deleteProject)

export default router
