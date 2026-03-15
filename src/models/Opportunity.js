import mongoose from 'mongoose'

const opportunitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['internship', 'job'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true },
    location: { type: String, default: 'Remote' },
    mode: { type: String, default: 'Hybrid' },
    experience: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)

export const Opportunity = mongoose.model('Opportunity', opportunitySchema)
