import mongoose from 'mongoose'

const contactLeadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '' },
    company: { type: String, default: '' },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['new', 'in_progress', 'closed'],
      default: 'new',
    },
    isUnreadForAdmin: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastViewedByAdminAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

export const ContactLead = mongoose.model('ContactLead', contactLeadSchema)
