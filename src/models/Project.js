import mongoose from 'mongoose'

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true },
    details: { type: String, default: '' },
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

export const Project = mongoose.model('Project', projectSchema)
