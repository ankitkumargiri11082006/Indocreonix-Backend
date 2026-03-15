import { asyncHandler } from '../utils/asyncHandler.js'
import { User } from '../models/User.js'
import { ApiError } from '../utils/apiError.js'
import { cloudinary } from '../config/cloudinary.js'

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
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
  const users = await User.find().sort({ createdAt: -1 }).select('-password')
  res.json({ users })
})

export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { role, isActive } = req.body

  const user = await User.findById(id)
  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  if (role) {
    user.role = role
  }

  if (typeof isActive === 'boolean') {
    user.isActive = isActive
  }

  await user.save()

  res.json({ message: 'User updated' })
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
