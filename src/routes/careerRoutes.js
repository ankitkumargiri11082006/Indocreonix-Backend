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
  requestOnboardingDocs,
  submitOnboardingDocs,
  deleteOnboardingDocs,
  sendOfferLetter,
  sendCertificate,
  updateOfferLetterApproval,
  updateCertificateApproval,
  deleteOfferLetter,
  deleteCertificate,
  deleteApplication,
} from '../controllers/careerController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'
import { uploadCvPdf, uploadOnboardingDocs } from '../middlewares/upload.js'

const router = Router()

router.get('/opportunities/public', getPublicOpportunities)
router.get('/opportunities', protect, permit('admin', 'editor'), requirePermission('openings'), getAdminOpportunities)
router.post('/opportunities', protect, permit('admin', 'editor'), requirePermission('openings'), createOpportunity)
router.put('/opportunities/:id', protect, permit('admin', 'editor'), requirePermission('openings'), updateOpportunity)
router.delete('/opportunities/:id', protect, permit('admin'), requirePermission('openings'), deleteOpportunity)

router.post('/applications', uploadCvPdf.single('cv'), submitApplication)
router.post('/applications/:id/submit-onboarding-docs', uploadOnboardingDocs, submitOnboardingDocs)
router.get('/applications', protect, permit('admin', 'editor'), requirePermission('applications'), getApplications)
router.get('/applications/export.csv', protect, permit('admin', 'editor'), requirePermission('applications'), exportApplicationsCsv)
router.patch('/applications/:id', protect, permit('admin', 'editor'), requirePermission('applications'), updateApplicationStatus)
router.post('/applications/:id/request-onboarding-docs', protect, permit('admin', 'editor'), requirePermission('applications'), requestOnboardingDocs)
router.post('/applications/:id/offer-letter/send', protect, permit('admin', 'editor'), requirePermission('applications'), sendOfferLetter)
router.post('/applications/:id/certificate/send', protect, permit('admin', 'editor'), requirePermission('applications'), sendCertificate)
router.patch('/applications/:id/offer-letter/approval', protect, permit('admin', 'editor'), requirePermission('applications'), updateOfferLetterApproval)
router.patch('/applications/:id/certificate/approval', protect, permit('admin', 'editor'), requirePermission('applications'), updateCertificateApproval)
router.delete('/applications/:id/offer-letter', protect, permit('admin', 'editor'), requirePermission('applications'), deleteOfferLetter)
router.delete('/applications/:id/certificate', protect, permit('admin', 'editor'), requirePermission('applications'), deleteCertificate)
router.delete(
  '/applications/:id/onboarding-docs',
  protect,
  permit('admin', 'editor'),
  requirePermission('applications'),
  deleteOnboardingDocs
)
router.delete('/applications/:id', protect, permit('admin'), requirePermission('applications'), deleteApplication)

export default router
