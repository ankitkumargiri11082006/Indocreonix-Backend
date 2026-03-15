import mongoose from 'mongoose'

const adminAuditLogSchema = new mongoose.Schema(
  {
    actor: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      email: { type: String, default: '' },
      role: { type: String, default: '' },
    },
    action: { type: String, required: true, trim: true },
    entity: { type: String, required: true, trim: true },
    entityId: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
)

export const AdminAuditLog = mongoose.model('AdminAuditLog', adminAuditLogSchema)
