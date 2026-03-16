import mongoose from 'mongoose'

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true },
    details: { type: String, default: '' },
    developerName: { type: String, default: '', trim: true },
    logo: { type: String, default: '' },
    website: { type: String, default: '' },
    category: { type: String, default: 'General' },
    tags: [{ type: String }],
    featured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)

projectSchema.index({ isActive: 1, order: 1, createdAt: -1 })

export const Project = mongoose.model('Project', projectSchema)
