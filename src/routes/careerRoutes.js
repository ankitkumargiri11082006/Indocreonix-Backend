import { Router } from 'express'
import {
  getPublicOpportunities,
  getAdminOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  submitApplication,
  getApplications,
  exportApplicationsCsv,
  updateApplicationStatus,
  deleteApplication,
} from '../controllers/careerController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'
import { uploadCvPdf } from '../middlewares/upload.js'

const router = Router()

router.get('/opportunities/public', getPublicOpportunities)
router.get('/opportunities', protect, permit('admin', 'editor'), requirePermission('openings'), getAdminOpportunities)
router.post('/opportunities', protect, permit('admin', 'editor'), requirePermission('openings'), createOpportunity)
router.put('/opportunities/:id', protect, permit('admin', 'editor'), requirePermission('openings'), updateOpportunity)
router.delete('/opportunities/:id', protect, permit('admin'), requirePermission('openings'), deleteOpportunity)

router.post('/applications', uploadCvPdf.single('cv'), submitApplication)
router.get('/applications', protect, permit('admin', 'editor'), requirePermission('applications'), getApplications)
router.get('/applications/export.csv', protect, permit('admin', 'editor'), requirePermission('applications'), exportApplicationsCsv)
router.patch('/applications/:id', protect, permit('admin', 'editor'), requirePermission('applications'), updateApplicationStatus)
router.delete('/applications/:id', protect, permit('admin'), requirePermission('applications'), deleteApplication)

export default router
