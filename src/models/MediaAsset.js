import mongoose from 'mongoose'

const mediaAssetSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    format: { type: String, default: '' },
    size: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tags: [{ type: String }],
  },
  { timestamps: true }
)

export const MediaAsset = mongoose.model('MediaAsset', mediaAssetSchema)
