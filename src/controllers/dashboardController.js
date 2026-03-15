import { asyncHandler } from '../utils/asyncHandler.js'
import { User } from '../models/User.js'
import { ContactLead } from '../models/ContactLead.js'
import { MediaAsset } from '../models/MediaAsset.js'

export const getDashboardStats = asyncHandler(async (_req, res) => {
  const [totalUsers, activeUsers, totalLeads, newLeads, mediaCount] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    ContactLead.countDocuments(),
    ContactLead.countDocuments({ status: 'new' }),
    MediaAsset.countDocuments(),
  ])

  res.json({
    totalUsers,
    activeUsers,
    totalLeads,
    newLeads,
    mediaCount,
    growth: {
      visitors: 14.2,
      leads: 9.3,
      conversions: 3.8,
    },
  })
})
