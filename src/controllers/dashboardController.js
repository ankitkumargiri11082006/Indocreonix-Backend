import { asyncHandler } from '../utils/asyncHandler.js'
import { User } from '../models/User.js'
import { ContactLead } from '../models/ContactLead.js'
import { CareerApplication } from '../models/CareerApplication.js'
import { MediaAsset } from '../models/MediaAsset.js'

function canAccessPermission(user, permissionKey) {
  if (!user) return false
  if (user.role === 'superadmin' || user.role === 'editor') return true
  if (user.role !== 'admin') return false
  return Boolean(user.permissions?.[permissionKey])
}

export const getDashboardStats = asyncHandler(async (_req, res) => {
  const [totalUsers, activeUsers, totalLeads, newLeads, totalApplications, newApplications, mediaCount] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    ContactLead.countDocuments(),
    ContactLead.countDocuments({ status: 'new' }),
    CareerApplication.countDocuments(),
    CareerApplication.countDocuments({ status: 'new' }),
    MediaAsset.countDocuments(),
  ])

  res.json({
    totalUsers,
    activeUsers,
    totalLeads,
    newLeads,
    totalApplications,
    newApplications,
    mediaCount,
    growth: {
      visitors: 14.2,
      leads: 9.3,
      conversions: 3.8,
    },
  })
})

export const getSectionIndicators = asyncHandler(async (req, res) => {
  const canViewLeads = canAccessPermission(req.user, 'leads')
  const canViewApplications = canAccessPermission(req.user, 'applications')

  const [leadsUnreadCount, applicationsUnreadCount] = await Promise.all([
    canViewLeads ? ContactLead.countDocuments({ isUnreadForAdmin: true }) : 0,
    canViewApplications ? CareerApplication.countDocuments({ isUnreadForAdmin: true }) : 0,
  ])

  res.json({
    sections: {
      leads: leadsUnreadCount,
      applications: applicationsUnreadCount,
    },
  })
})
