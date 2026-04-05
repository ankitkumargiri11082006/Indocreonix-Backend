import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { User } from '../models/User.js'
import { signToken } from '../utils/token.js'
import { DEFAULT_ADMIN_PERMISSIONS } from '../constants/adminPermissions.js'
import { env } from '../config/env.js'
import { verifyGoogleIdToken } from '../utils/googleAuth.js'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { sendPasswordResetOtpEmail } from '../utils/emailService.js'

const PASSWORD_RESET_OTP_EXPIRES_MINUTES = Number(process.env.ADMIN_RESET_OTP_EXPIRES_MINUTES || 10)
const PASSWORD_RESET_TOKEN_EXPIRES_MINUTES = Number(process.env.ADMIN_RESET_TOKEN_EXPIRES_MINUTES || 15)

function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function hashToken(token = '') {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

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

  const normalizedEmail = String(email).toLowerCase().trim()
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+password +failedLoginAttempts +passwordResetRequired'
  )

  if (!user) {
    throw new ApiError(401, 'Invalid credentials')
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Your account is disabled')
  }

  if (user.passwordResetRequired) {
    throw new ApiError(403, 'Password reset required. Please reset your password to continue.')
  }

  const isValid = await user.comparePassword(password)
  if (!isValid) {
    user.failedLoginAttempts = Number(user.failedLoginAttempts || 0) + 1

    if (user.failedLoginAttempts >= 3) {
      user.passwordResetRequired = true
    }

    await user.save()
    throw new ApiError(
      user.passwordResetRequired ? 403 : 401,
      user.passwordResetRequired
        ? 'Too many incorrect attempts. Password reset is required.'
        : 'Invalid credentials'
    )
  }

  await ensureBootstrapSuperadmin(user)

  user.failedLoginAttempts = 0
  user.passwordResetRequired = false

  user.lastLoginAt = new Date()
  await user.save()

  const token = signToken(user._id.toString())

  res.json({
    message: 'Login successful',
    token,
    user: sanitizeUser(user),
  })
})

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body

  if (!email) {
    throw new ApiError(400, 'Email is required')
  }

  const normalizedEmail = String(email).toLowerCase().trim()
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+passwordResetOtpHash +passwordResetOtpExpiresAt'
  )

  // Prevent account enumeration
  if (!user) {
    return res.json({ message: 'If an account exists, an OTP has been sent.' })
  }

  if (!user.isActive) {
    return res.json({ message: 'If an account exists, an OTP has been sent.' })
  }

  const otp = createOtpCode()
  user.passwordResetOtpHash = await bcrypt.hash(otp, 12)
  user.passwordResetOtpExpiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_EXPIRES_MINUTES * 60 * 1000)
  await user.save()

  await sendPasswordResetOtpEmail(normalizedEmail, {
    name: user.name,
    otp,
    expiresInMinutes: PASSWORD_RESET_OTP_EXPIRES_MINUTES,
    audience: 'admin account',
  })

  res.json({ message: 'OTP sent to your email address' })
})

export const verifyForgotOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body

  if (!email || !otp) {
    throw new ApiError(400, 'Email and OTP are required')
  }

  const normalizedEmail = String(email).toLowerCase().trim()
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetTokenHash +passwordResetTokenExpiresAt'
  )

  if (!user || !user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
    throw new ApiError(400, 'OTP is not generated or has expired. Request a new OTP.')
  }

  if (user.passwordResetOtpExpiresAt.getTime() < Date.now()) {
    user.passwordResetOtpHash = ''
    user.passwordResetOtpExpiresAt = null
    await user.save()
    throw new ApiError(400, 'OTP has expired. Request a new OTP.')
  }

  const isOtpValid = await bcrypt.compare(String(otp), user.passwordResetOtpHash)
  if (!isOtpValid) {
    throw new ApiError(401, 'Invalid OTP code')
  }

  const resetToken = crypto.randomBytes(32).toString('hex')
  user.passwordResetTokenHash = hashToken(resetToken)
  user.passwordResetTokenExpiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000)
  user.passwordResetOtpHash = ''
  user.passwordResetOtpExpiresAt = null
  await user.save()

  res.json({ resetToken })
})

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, resetToken, newPassword } = req.body

  if (!email || !resetToken || !newPassword) {
    throw new ApiError(400, 'Email, resetToken and newPassword are required')
  }

  if (String(newPassword).length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters')
  }

  const normalizedEmail = String(email).toLowerCase().trim()
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+password +passwordResetTokenHash +passwordResetTokenExpiresAt +failedLoginAttempts +passwordResetRequired'
  )

  if (!user || !user.passwordResetTokenHash || !user.passwordResetTokenExpiresAt) {
    throw new ApiError(400, 'Reset token is invalid or expired. Please restart the reset process.')
  }

  if (user.passwordResetTokenExpiresAt.getTime() < Date.now()) {
    user.passwordResetTokenHash = ''
    user.passwordResetTokenExpiresAt = null
    await user.save()
    throw new ApiError(400, 'Reset token has expired. Please restart the reset process.')
  }

  const isTokenValid = hashToken(resetToken) === user.passwordResetTokenHash
  if (!isTokenValid) {
    throw new ApiError(401, 'Invalid reset token')
  }

  user.password = String(newPassword)
  user.passwordResetTokenHash = ''
  user.passwordResetTokenExpiresAt = null
  user.passwordResetRequired = false
  user.failedLoginAttempts = 0
  await user.save()

  res.json({ message: 'Password reset successful' })
})

export const loginWithGoogle = asyncHandler(async (req, res) => {
  const { credential } = req.body

  if (!credential) {
    throw new ApiError(400, 'Google credential is required')
  }

  if (!env.googleClientId) {
    throw new ApiError(500, 'GOOGLE_CLIENT_ID is not configured on server')
  }

  let payload
  try {
    payload = await verifyGoogleIdToken(credential, env.googleClientId)
  } catch {
    throw new ApiError(401, 'Invalid Google credential')
  }

  const email = payload?.email?.toLowerCase?.().trim?.()
  if (!email || payload?.email_verified !== true) {
    throw new ApiError(401, 'Google account email is not verified')
  }

  const user = await User.findOne({ email })
  if (!user) {
    throw new ApiError(403, 'No account found for this Google email')
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Your account is disabled')
  }

  if (user.passwordResetRequired) {
    throw new ApiError(403, 'Password reset required. Please reset your password to continue.')
  }

  await ensureBootstrapSuperadmin(user)

  if (!user.name && payload?.name) {
    user.name = payload.name
  }

  if (!user.avatarUrl && payload?.picture) {
    user.avatarUrl = payload.picture
  }

  user.lastLoginAt = new Date()
  await user.save()

  const token = signToken(user._id.toString())

  res.json({
    message: 'Google login successful',
    token,
    user: sanitizeUser(user),
  })
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
