import { asyncHandler } from '../utils/asyncHandler.js'
import { User } from '../models/User.js'
import { ContactLead } from '../models/ContactLead.js'
import { CareerApplication } from '../models/CareerApplication.js'
import { MediaAsset } from '../models/MediaAsset.js'
import { ProjectOrder } from '../models/ProjectOrder.js'
import { Client } from '../models/Client.js'
import { Service } from '../models/Service.js'
import { Project } from '../models/Project.js'
import { Opportunity } from '../models/Opportunity.js'
import { getCached, setCached } from '../utils/publicCache.js'

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
  const canViewOrders = canAccessPermission(req.user, 'orders')

  const cacheKey = [Number(canViewLeads), Number(canViewApplications), Number(canViewOrders)].join('-')
  const cachedIndicators = getCached('dashboard:indicators', cacheKey)
  if (cachedIndicators) {
    return res.json(cachedIndicators)
  }

  const [leadsUnreadCount, applicationsUnreadCount, ordersUnreadCount] = await Promise.all([
    canViewLeads ? ContactLead.countDocuments({ isUnreadForAdmin: true }) : 0,
    canViewApplications ? CareerApplication.countDocuments({ isUnreadForAdmin: true }) : 0,
    canViewOrders ? ProjectOrder.countDocuments({ isUnreadForAdmin: true }) : 0,
  ])

  const response = {
    sections: {
      leads: leadsUnreadCount,
      applications: applicationsUnreadCount,
      orders: ordersUnreadCount,
    },
  }

  setCached('dashboard:indicators', response, { key: cacheKey, ttlMs: 10_000 })

  res.json(response)
})

function normalizeCounts(keys, docs) {
  const map = docs.reduce((acc, doc) => {
    acc[doc._id] = doc.count
    return acc
  }, {})

  return keys.map((key) => ({ key, count: map[key] || 0 }))
}

export const getAnalyticsOverview = asyncHandler(async (_req, res) => {
  const [
    totalLeads,
    totalApplications,
    totalOrders,
    totalServices,
    totalClients,
    totalProjects,
    totalOpportunities,
    leadStatusAgg,
    orderStatusAgg,
    orderCategoryAgg,
    applicationStatusAgg,
    applicationTypeAgg,
  ] = await Promise.all([
    ContactLead.countDocuments(),
    CareerApplication.countDocuments(),
    ProjectOrder.countDocuments(),
    Service.countDocuments({ isActive: true }),
    Client.countDocuments({ isActive: true }),
    Project.countDocuments({ isActive: true }),
    Opportunity.countDocuments({ isActive: true }),
    ContactLead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    ProjectOrder.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    ProjectOrder.aggregate([
      { $group: { _id: '$projectCategory', count: { $sum: 1 } } },
    ]),
    CareerApplication.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    CareerApplication.aggregate([
      { $group: { _id: '$roleType', count: { $sum: 1 } } },
    ]),
  ])

  const leadStatusKeys = ['new', 'in_progress', 'closed']
  const orderStatusKeys = ['new', 'qualified', 'proposal_shared', 'in_discussion', 'won', 'lost']
  const orderCategoryKeys = ['website', 'web-app', 'android-app', 'ios-app', 'software', 'other']
  const applicationStatusKeys = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired']
  const applicationTypeKeys = ['internship', 'job']

  res.json({
    totals: {
      leads: totalLeads,
      applications: totalApplications,
      orders: totalOrders,
      services: totalServices,
      clients: totalClients,
      projects: totalProjects,
      opportunities: totalOpportunities,
    },
    breakdowns: {
      leadsByStatus: normalizeCounts(leadStatusKeys, leadStatusAgg),
      ordersByStatus: normalizeCounts(orderStatusKeys, orderStatusAgg),
      ordersByCategory: normalizeCounts(orderCategoryKeys, orderCategoryAgg),
      applicationsByStatus: normalizeCounts(applicationStatusKeys, applicationStatusAgg),
      applicationsByType: normalizeCounts(applicationTypeKeys, applicationTypeAgg),
    },
  })
})
