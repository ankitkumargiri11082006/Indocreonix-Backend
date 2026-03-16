import mongoose from 'mongoose'

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: '' },
    website: { type: String, default: '' },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)

clientSchema.index({ isActive: 1, order: 1, createdAt: -1 })

export const Client = mongoose.model('Client', clientSchema)
