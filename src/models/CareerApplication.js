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
    consentAccepted: {
      type: Boolean,
      default: false,
    },
    consentAcceptedAt: {
      type: Date,
      default: null,
    },
    cvUrl: { type: String, required: true },
    cvPublicId: { type: String, required: true },
    cvResourceType: {
      type: String,
      enum: ['image', 'raw'],
      default: 'raw',
    },
    cvOriginalName: { type: String, default: '' },
    cvBytes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'],
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
    adminNotes: { type: String, default: '' },
    onboardingDocsUrl: { type: String, default: '' },
    onboardingDocsPublicId: { type: String, default: '' },
    onboardingDocsResourceType: { type: String, enum: ['image', 'raw'], default: 'image' },
    onboardingDocsSubmittedAt: { type: Date, default: null },
    onboardingDocsOriginalName: { type: String, default: '' },
    onboardingDocsBytes: { type: Number, default: 0 },
    offerLetter: {
      candidateName: { type: String, default: '' },
      candidateAddress: { type: String, default: '' },
      role: { type: String, default: '' },
      startDate: { type: String, default: '' },
      duration: { type: String, default: '' },
      stipend: { type: String, default: '' },
      managerName: { type: String, default: '' },
      managerTitle: { type: String, default: '' },
      publicId: { type: String, default: '' },
      resourceType: { type: String, enum: ['image', 'raw'], default: 'raw' },
      url: { type: String, default: '' },
      sentAt: { type: Date, default: null },
      sentByEmail: { type: String, default: '' },
      isApproved: { type: Boolean, default: false },
      approvedAt: { type: Date, default: null },
      approvedByEmail: { type: String, default: '' },
      approvalNotes: { type: String, default: '' },
    },
    certificate: {
      fullName: { type: String, default: '' },
      courseTitle: { type: String, default: '' },
      completionDate: { type: String, default: '' },
      certificateId: { type: String, default: '' },
      publicId: { type: String, default: '' },
      resourceType: { type: String, enum: ['image', 'raw'], default: 'raw' },
      url: { type: String, default: '' },
      sentAt: { type: Date, default: null },
      sentByEmail: { type: String, default: '' },
      isApproved: { type: Boolean, default: false },
      approvedAt: { type: Date, default: null },
      approvedByEmail: { type: String, default: '' },
      approvalNotes: { type: String, default: '' },
    },
  },
  { timestamps: true }
)

careerApplicationSchema.index({ roleType: 1, status: 1, createdAt: -1 })
careerApplicationSchema.index({ createdAt: -1 })

export const CareerApplication = mongoose.model('CareerApplication', careerApplicationSchema)
