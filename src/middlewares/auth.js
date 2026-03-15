import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User } from '../models/User.js'
import { ApiError } from '../utils/apiError.js'
import { DEFAULT_ADMIN_PERMISSIONS } from '../constants/adminPermissions.js'

export async function protect(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies?.token

  if (!token) {
    return next(new ApiError(401, 'Unauthorized'))
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret)
    const user = await User.findById(decoded.sub)
    if (!user || !user.isActive) {
      return next(new ApiError(401, 'Unauthorized'))
    }
    req.user = user
    return next()
  } catch {
    return next(new ApiError(401, 'Invalid token'))
  }
}

export function permit(...roles) {
  return (req, res, next) => {
    if (req.user?.role === 'superadmin') {
      return next()
    }

    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Forbidden'))
    }
    return next()
  }
}

export function requirePermission(permissionKey) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(403, 'Forbidden'))
    }

    if (req.user.role === 'superadmin' || req.user.role === 'editor') {
      return next()
    }

    if (req.user.role !== 'admin') {
      return next(new ApiError(403, 'Forbidden'))
    }

    const permissions = req.user.permissions || DEFAULT_ADMIN_PERMISSIONS
    if (!permissions[permissionKey]) {
      return next(new ApiError(403, 'You do not have access for this section'))
    }

    return next()
  }
}
