import mongoose from 'mongoose'

const serviceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)

serviceSchema.index({ isActive: 1, order: 1, createdAt: -1 })

export const Service = mongoose.model('Service', serviceSchema)
