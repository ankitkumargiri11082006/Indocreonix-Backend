import { asyncHandler } from '../utils/asyncHandler.js'
import { AdminAuditLog } from '../models/AdminAuditLog.js'
import { ApiError } from '../utils/apiError.js'

function buildAuditLogQuery({ action, actorEmail, from, to } = {}) {
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

  return query
}

export const getAuditLogs = asyncHandler(async (req, res) => {
  const { action, actorEmail, from, to, page = '1', limit = '20' } = req.query
  const query = buildAuditLogQuery({ action, actorEmail, from, to })

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

export const deleteAuditLog = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'superadmin') {
    throw new ApiError(403, 'Only superadmin can delete audit logs')
  }

  const item = await AdminAuditLog.findById(req.params.id)
  if (!item) {
    throw new ApiError(404, 'Audit log not found')
  }

  await item.deleteOne()

  res.json({ message: 'Audit log deleted' })
})

export const deleteAuditLogsBulk = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'superadmin') {
    throw new ApiError(403, 'Only superadmin can delete audit logs')
  }

  const { action, actorEmail, from, to } = req.query
  const hasFilter = Boolean(
    String(action || '').trim() ||
      String(actorEmail || '').trim() ||
      String(from || '').trim() ||
      String(to || '').trim(),
  )

  if (!hasFilter) {
    throw new ApiError(400, 'Provide at least one filter before bulk delete')
  }

  const query = buildAuditLogQuery({
    action: String(action || '').trim(),
    actorEmail: String(actorEmail || '').trim(),
    from: String(from || '').trim(),
    to: String(to || '').trim(),
  })

  const result = await AdminAuditLog.deleteMany(query)

  res.json({
    message: 'Audit logs deleted',
    deletedCount: result.deletedCount || 0,
  })
})
