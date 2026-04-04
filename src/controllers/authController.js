import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { User } from '../models/User.js'
import { signToken } from '../utils/token.js'
import { DEFAULT_ADMIN_PERMISSIONS } from '../constants/adminPermissions.js'

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    permissions: user.permissions || DEFAULT_ADMIN_PERMISSIONS,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  }
}

async function ensureBootstrapSuperadmin(user) {
  if (user.role !== 'admin') return user

  const superadminCount = await User.countDocuments({ role: 'superadmin' })
  if (superadminCount > 0) return user

  user.role = 'superadmin'
  await user.save()
  return user
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required')
  }

  const user = await User.findOne({ email }).select('+password')
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid credentials')
  }

  await ensureBootstrapSuperadmin(user)

  user.lastLoginAt = new Date()
  await user.save()

  const token = signToken(user._id.toString())

  res.json({
    message: 'Login successful',
    token,
    user: sanitizeUser(user),
  })
})

export const loginWithGoogle = asyncHandler(async () => {
  throw new ApiError(501, 'Google login is not configured')
})

export const me = asyncHandler(async (req, res) => {
  await ensureBootstrapSuperadmin(req.user)
  res.json({ user: sanitizeUser(req.user) })
})

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current password and new password are required')
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters')
  }

  const user = await User.findById(req.user._id).select('+password')
  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  const isCurrentPasswordValid = await user.comparePassword(currentPassword)
  if (!isCurrentPasswordValid) {
    throw new ApiError(400, 'Current password is incorrect')
  }

  const isSamePassword = await user.comparePassword(newPassword)
  if (isSamePassword) {
    throw new ApiError(400, 'New password must be different from current password')
  }

  user.password = newPassword
  await user.save()

  res.json({ message: 'Password changed successfully' })
})
