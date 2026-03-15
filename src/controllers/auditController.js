import { asyncHandler } from '../utils/asyncHandler.js'
import { AdminAuditLog } from '../models/AdminAuditLog.js'

export const getAuditLogs = asyncHandler(async (req, res) => {
  const { action, actorEmail, from, to, page = '1', limit = '20' } = req.query

  const query = {}

  if (action) {
    query.action = action
  }

  if (actorEmail) {
    query['actor.email'] = { $regex: actorEmail, $options: 'i' }
  }

  if (from || to) {
    query.createdAt = {}
    if (from) query.createdAt.$gte = new Date(from)
    if (to) query.createdAt.$lte = new Date(to)
  }

  const pageNumber = Math.max(1, Number(page) || 1)
  const limitNumber = Math.min(100, Math.max(1, Number(limit) || 20))
  const skip = (pageNumber - 1) * limitNumber

  const [items, total] = await Promise.all([
    AdminAuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNumber),
    AdminAuditLog.countDocuments(query),
  ])

  res.json({
    items,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  })
})
