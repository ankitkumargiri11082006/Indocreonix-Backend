import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { DEFAULT_ADMIN_PERMISSIONS } from '../constants/adminPermissions.js'

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'editor', 'viewer'],
      default: 'viewer',
    },
    permissions: {
      dashboard: { type: Boolean, default: true },
      analytics: { type: Boolean, default: true },
      auditLogs: { type: Boolean, default: true },
      projects: { type: Boolean, default: true },
      clients: { type: Boolean, default: true },
      services: { type: Boolean, default: true },
      content: { type: Boolean, default: true },
      media: { type: Boolean, default: true },
      leads: { type: Boolean, default: true },
      openings: { type: Boolean, default: true },
      applications: { type: Boolean, default: true },
      users: { type: Boolean, default: true },
      integrations: { type: Boolean, default: true },
      settings: { type: Boolean, default: true },
      profile: { type: Boolean, default: true },
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    avatarPublicId: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: Date,
  },
  { timestamps: true }
)

userSchema.pre('save', async function preSave(next) {
  if (!this.permissions) {
    this.permissions = { ...DEFAULT_ADMIN_PERMISSIONS }
  }

  if (this.role === 'superadmin') {
    this.permissions = { ...DEFAULT_ADMIN_PERMISSIONS }
  }

  if (!this.isModified('password')) return next()
  const salt = await bcrypt.genSalt(12)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

export const User = mongoose.model('User', userSchema)
