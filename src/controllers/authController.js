import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { User } from '../models/User.js'
import { signToken } from '../utils/token.js'

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

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email and password are required')
  }

  const existing = await User.findOne({ email })
  if (existing) {
    throw new ApiError(409, 'Email already registered')
  }

  const usersCount = await User.countDocuments()

  const user = await User.create({
    name,
    email,
    password,
    role: usersCount === 0 ? 'admin' : 'viewer',
  })

  const token = signToken(user._id.toString())

  res.status(201).json({
    message: 'Signup successful',
    token,
    user: sanitizeUser(user),
  })
})

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required')
  }

  const user = await User.findOne({ email }).select('+password')
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid credentials')
  }

  user.lastLoginAt = new Date()
  await user.save()

  const token = signToken(user._id.toString())

  res.json({
    message: 'Login successful',
    token,
    user: sanitizeUser(user),
  })
})

export const me = asyncHandler(async (req, res) => {
  res.json({ user: sanitizeUser(req.user) })
})
