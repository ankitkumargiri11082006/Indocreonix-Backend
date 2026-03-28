import { Router } from 'express'
import {
  deletePortalUserAdmin,
  getMyCareerApplications,
  getMyProjects,
  getPortalCareerApplicationsAdmin,
  getPortalProjectsAdmin,
  getPortalUserDetailsAdmin,
  getPortalUsersAdmin,
  loginOrSignupWithGooglePortal,
  loginPortal,
  sendPortalOtp,
  updateMyPortalProfile,
  updatePortalCareerApplicationAdmin,
  updatePortalProjectAdmin,
  updatePortalUserAdmin,
  verifyPortalOtpAndRegister,
} from '../controllers/portalController.js'
import { permit, protect, requirePermission } from '../middlewares/auth.js'
import { protectPortalUser } from '../middlewares/portalAuth.js'

const router = Router()

router.post('/auth/send-otp', sendPortalOtp)
router.post('/auth/verify-otp-register', verifyPortalOtpAndRegister)
router.post('/auth/login', loginPortal)
router.post('/auth/google', loginOrSignupWithGooglePortal)

router.get('/career/applications/me', protectPortalUser, getMyCareerApplications)
router.get('/projects/me', protectPortalUser, getMyProjects)
router.patch('/profile/me', protectPortalUser, updateMyPortalProfile)

router.get('/admin/users', protect, permit('admin', 'editor'), requirePermission('portalControl'), getPortalUsersAdmin)
router.get('/admin/users/:id/details', protect, permit('admin', 'editor'), requirePermission('portalControl'), getPortalUserDetailsAdmin)
router.patch('/admin/users/:id', protect, permit('admin'), requirePermission('portalControl'), updatePortalUserAdmin)
router.delete('/admin/users/:id', protect, permit('admin'), requirePermission('portalControl'), deletePortalUserAdmin)

router.get(
  '/admin/career-applications',
  protect,
  permit('admin', 'editor'),
  requirePermission('portalControl'),
  getPortalCareerApplicationsAdmin
)
router.patch(
  '/admin/career-applications/:id',
  protect,
  permit('admin', 'editor'),
  requirePermission('portalControl'),
  updatePortalCareerApplicationAdmin
)

router.get('/admin/projects', protect, permit('admin', 'editor'), requirePermission('portalControl'), getPortalProjectsAdmin)
router.patch('/admin/projects/:id', protect, permit('admin', 'editor'), requirePermission('portalControl'), updatePortalProjectAdmin)

export default router
