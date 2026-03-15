import { asyncHandler } from '../utils/asyncHandler.js'
import { User } from '../models/User.js'
import { ApiError } from '../utils/apiError.js'

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
