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
import { permit, protect } from '../middlewares/auth.js'
import { uploadCvPdf } from '../middlewares/upload.js'

const router = Router()

router.get('/opportunities/public', getPublicOpportunities)
router.get('/opportunities', protect, permit('admin', 'editor'), getAdminOpportunities)
router.post('/opportunities', protect, permit('admin', 'editor'), createOpportunity)
router.put('/opportunities/:id', protect, permit('admin', 'editor'), updateOpportunity)
router.delete('/opportunities/:id', protect, permit('admin'), deleteOpportunity)

router.post('/applications', uploadCvPdf.single('cv'), submitApplication)
router.get('/applications', protect, permit('admin', 'editor'), getApplications)
router.get('/applications/export.csv', protect, permit('admin', 'editor'), exportApplicationsCsv)
router.patch('/applications/:id', protect, permit('admin', 'editor'), updateApplicationStatus)
router.delete('/applications/:id', protect, permit('admin'), deleteApplication)

export default router
