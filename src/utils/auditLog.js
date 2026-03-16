import { AdminAuditLog } from '../models/AdminAuditLog.js'

function getRequestIp(req) {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }

  return req.ip || ''
}

export async function createAdminAuditLog(req, { action, entity, entityId = '', metadata = {} } = {}) {
  if (!action || !entity) return

  try {
    await AdminAuditLog.create({
      actor: {
        id: req.user?._id || null,
        email: req.user?.email || '',
        role: req.user?.role || '',
      },
      action,
      entity,
      entityId: entityId ? String(entityId) : '',
      metadata,
      ip: getRequestIp(req),
      userAgent: req.get('user-agent') || '',
    })
  } catch (_error) {}
}