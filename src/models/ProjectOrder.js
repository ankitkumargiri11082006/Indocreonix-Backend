import mongoose from 'mongoose'

const projectOrderSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    company: { type: String, default: '', trim: true },
    targetBudget: { type: String, default: '', trim: true },
    targetTimeline: { type: String, default: '', trim: true },
    projectCategory: {
      type: String,
      enum: ['website', 'web-app', 'android-app', 'ios-app', 'software', 'other'],
      required: true,
    },
    projectSubtype: { type: String, default: '', trim: true },
    requestedService: { type: String, default: '', trim: true },
    requestedProduct: { type: String, default: '', trim: true },
    projectReference: { type: String, default: '', trim: true },
    businessGoals: { type: String, required: true, trim: true },
    projectSummary: { type: String, required: true, trim: true },
    featureRequirements: { type: String, default: '', trim: true },
    prdUrl: { type: String, default: '' },
    prdDownloadUrl: { type: String, default: '' },
    prdPublicId: { type: String, default: '' },
    prdOriginalName: { type: String, default: '' },
    prdBytes: { type: Number, default: 0 },
    prdFormat: { type: String, default: '' },
    prdResourceType: { type: String, default: '' },
    supportingDocuments: {
      type: [
        {
          name: { type: String, default: '' },
          url: { type: String, default: '' },
          downloadUrl: { type: String, default: '' },
          publicId: { type: String, default: '' },
          bytes: { type: Number, default: 0 },
          format: { type: String, default: '' },
          resourceType: { type: String, default: '' },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ['new', 'qualified', 'proposal_shared', 'in_discussion', 'won', 'lost'],
      default: 'new',
    },
    adminNotes: { type: String, default: '' },
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

projectOrderSchema.index({ status: 1, createdAt: -1 })
projectOrderSchema.index({ createdAt: -1 })

export const ProjectOrder = mongoose.model('ProjectOrder', projectOrderSchema)
