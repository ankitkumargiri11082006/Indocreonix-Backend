import mongoose from 'mongoose'

const careerApplicationSchema = new mongoose.Schema(
  {
    roleType: {
      type: String,
      enum: ['internship', 'job'],
      required: true,
    },
    opportunity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
      default: null,
    },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    qualification: { type: String, required: true, trim: true },
    skills: { type: String, required: true, trim: true },
    experience: { type: String, required: true, trim: true },
    portfolio: { type: String, default: '' },
    message: { type: String, required: true, trim: true },
    cvUrl: { type: String, required: true },
    cvPublicId: { type: String, required: true },
    cvOriginalName: { type: String, default: '' },
    cvBytes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'],
      default: 'new',
    },
    adminNotes: { type: String, default: '' },
  },
  { timestamps: true }
)

export const CareerApplication = mongoose.model('CareerApplication', careerApplicationSchema)
