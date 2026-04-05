import { asyncHandler } from '../utils/asyncHandler.js'
import { User } from '../models/User.js'
import { ApiError } from '../utils/apiError.js'
import { cloudinary } from '../config/cloudinary.js'
import { DEFAULT_ADMIN_PERMISSIONS, FULL_ADMIN_PERMISSIONS, normalizePermissions } from '../constants/adminPermissions.js'
import { createAdminAuditLog } from '../utils/auditLog.js'

const MANAGEABLE_ROLES = ['admin', 'editor', 'viewer']

function buildUserSummary(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  }
}

function buildPermissionDelta(previousPermissions = {}, nextPermissions = {}) {
  const granted = []
  const revoked = []

  for (const key of Object.keys(DEFAULT_ADMIN_PERMISSIONS)) {
    const previousValue = Boolean(previousPermissions[key])
    const nextValue = Boolean(nextPermissions[key])

    if (previousValue === nextValue) continue
    if (nextValue) granted.push(key)
    else revoked.push(key)
  }

  return {
    granted,
    revoked,
  }
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

function extractCloudinaryPublicId(assetUrl = '') {
  if (!assetUrl || typeof assetUrl !== 'string') return ''

  const uploadSegment = '/upload/'
  const uploadIndex = assetUrl.indexOf(uploadSegment)
  if (uploadIndex === -1) return ''

  let pathAfterUpload = assetUrl.slice(uploadIndex + uploadSegment.length)
  pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '')

  return decodeURIComponent(pathAfterUpload.replace(/\.[^/.]+$/, ''))
}

function sanitizeFileName(name = '') {
  return name
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'avatar'
}

function uploadAvatarToCloudinary(fileBuffer, originalname) {
  return new Promise((resolve, reject) => {
    const safeName = sanitizeFileName(originalname)

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'indocreonix/avatars',
        resource_type: 'image',
        public_id: `avatar-${Date.now()}-${safeName}`,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error)
        return resolve(result)
      }
    )

    uploadStream.end(fileBuffer)
  })
}

export const getUsers = asyncHandler(async (_req, res) => {
  const users = await User.find()
    .sort({ createdAt: -1 })
    .select(
      '-password -passwordResetOtpHash -passwordResetOtpExpiresAt -passwordResetTokenHash -passwordResetTokenExpiresAt'
    )
  res.json({ users })
})

export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { role, isActive } = req.body

  if (!role && typeof isActive !== 'boolean') {
    throw new ApiError(400, 'Provide role or isActive to update')
  }

  const user = await User.findById(id)
  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  const previousRole = user.role
  const previousIsActive = user.isActive

  if (role) {
    if (!MANAGEABLE_ROLES.includes(role) && role !== 'superadmin') {
      throw new ApiError(400, 'Invalid role')
    }

    if (previousRole === 'superadmin' && role !== 'superadmin') {
      const superadminCount = await User.countDocuments({ role: 'superadmin' })
      if (superadminCount <= 1) {
        throw new ApiError(400, 'Cannot demote the last superadmin')
      }
    }

    user.role = role

    if (role === 'superadmin') {
      user.permissions = { ...FULL_ADMIN_PERMISSIONS }
    } else if (role === 'admin' && previousRole !== 'admin') {
      user.permissions = { ...DEFAULT_ADMIN_PERMISSIONS }
    }
  }

  if (typeof isActive === 'boolean') {
    user.isActive = isActive
  }

  await user.save()

  const changes = {}
  if (previousRole !== user.role) {
    changes.role = { from: previousRole, to: user.role }
  }
  if (previousIsActive !== user.isActive) {
    changes.isActive = { from: previousIsActive, to: user.isActive }
  }

  await createAdminAuditLog(req, {
    action: 'USER_ROLE_UPDATED',
    entity: 'user',
    entityId: user._id,
    metadata: {
      target: buildUserSummary(user),
      changes,
    },
  })

  res.json({ message: 'User updated' })
})

export const createManagedUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body

  if (!name || !email || !password || !role) {
    throw new ApiError(400, 'Name, email, password and role are required')
  }

  if (!MANAGEABLE_ROLES.includes(role)) {
    throw new ApiError(400, 'Role must be one of admin, editor, viewer')
  }

  const existing = await User.findOne({ email })
  if (existing) {
    throw new ApiError(409, 'Email already registered')
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
  })

  if (role === 'admin') {
    user.permissions = { ...DEFAULT_ADMIN_PERMISSIONS }
    await user.save()
  }

  await createAdminAuditLog(req, {
    action: 'USER_ROLE_ACCOUNT_CREATED',
    entity: 'user',
    entityId: user._id,
    metadata: {
      target: buildUserSummary(user),
      createdRole: role,
    },
  })

  res.status(201).json({
    message: 'User created successfully',
    user: sanitizeUser(user),
  })
})

export const deleteUserPermanently = asyncHandler(async (req, res) => {
  const { id } = req.params

  if (req.user._id.toString() === id) {
    throw new ApiError(400, 'You cannot delete your own account')
  }

  const user = await User.findById(id)
  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  if (user.role === 'superadmin') {
    const superadminCount = await User.countDocuments({ role: 'superadmin' })
    if (superadminCount <= 1) {
      throw new ApiError(400, 'Cannot delete the last superadmin')
    }
  }

  if (user.avatarPublicId) {
    try {
      await cloudinary.uploader.destroy(user.avatarPublicId, { resource_type: 'image' })
    } catch (_error) {}
  }

  const deletedUserSummary = buildUserSummary(user)

  await User.deleteOne({ _id: user._id })

  await createAdminAuditLog(req, {
    action: 'USER_ROLE_ACCOUNT_DELETED',
    entity: 'user',
    entityId: deletedUserSummary.id,
    metadata: {
      target: deletedUserSummary,
      deletionType: 'permanent',
    },
  })

  res.json({ message: 'User permanently deleted' })
})

export const updateAdminPermissions = asyncHandler(async (req, res) => {
  if (req.user.role !== 'superadmin') {
    throw new ApiError(403, 'Only superadmin can manage admin permissions')
  }

  const targetUser = await User.findById(req.params.id)
  if (!targetUser) {
    throw new ApiError(404, 'User not found')
  }

  if (targetUser.role !== 'admin') {
    throw new ApiError(400, 'Permissions can only be updated for admin users')
  }

  const previousPermissions = normalizePermissions(targetUser.permissions || {})
  const nextPermissions = normalizePermissions(req.body.permissions || {})
  const permissionDelta = buildPermissionDelta(previousPermissions, nextPermissions)

  if (permissionDelta.granted.length === 0 && permissionDelta.revoked.length === 0) {
    return res.json({
      message: 'Admin permissions already up to date',
      user: sanitizeUser(targetUser),
    })
  }

  targetUser.permissions = {
    ...DEFAULT_ADMIN_PERMISSIONS,
    ...nextPermissions,
  }

  await targetUser.save()

  await createAdminAuditLog(req, {
    action: 'ADMIN_PERMISSIONS_UPDATED',
    entity: 'user',
    entityId: targetUser._id,
    metadata: {
      target: buildUserSummary(targetUser),
      grantedPermissions: permissionDelta.granted,
      revokedPermissions: permissionDelta.revoked,
      totalEnabledPermissions: Object.values(targetUser.permissions || {}).filter(Boolean).length,
    },
  })

  res.json({
    message: 'Admin permissions updated',
    user: sanitizeUser(targetUser),
  })
})

export const updateMyAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Profile picture file is required')
  }

  const uploaded = await uploadAvatarToCloudinary(req.file.buffer, req.file.originalname)

  const user = await User.findById(req.user._id)
  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  const previousPublicId = user.avatarPublicId || extractCloudinaryPublicId(user.avatarUrl)

  user.avatarUrl = uploaded.secure_url
  user.avatarPublicId = uploaded.public_id
  await user.save()

  if (previousPublicId && previousPublicId !== uploaded.public_id) {
    await cloudinary.uploader.destroy(previousPublicId, { resource_type: 'image' })
  }

  res.json({
    message: 'Profile picture updated',
    user: sanitizeUser(user),
  })
})
