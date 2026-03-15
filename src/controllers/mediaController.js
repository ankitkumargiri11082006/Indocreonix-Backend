import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { MediaAsset } from '../models/MediaAsset.js'
import { cloudinary } from '../config/cloudinary.js'

function uploadBufferToCloudinary(fileBuffer, originalname) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'indocreonix',
        resource_type: 'image',
        public_id: `${Date.now()}-${originalname?.replace(/\s+/g, '-').toLowerCase()}`,
      },
      (error, result) => {
        if (error) return reject(error)
        return resolve(result)
      }
    )

    uploadStream.end(fileBuffer)
  })
}

export const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'File is required')
  }

  const uploaded = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname)

  const asset = await MediaAsset.create({
    title: req.body.title || req.file.originalname,
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    format: uploaded.format,
    size: req.file.size,
    uploadedBy: req.user._id,
    tags: req.body.tags ? req.body.tags.split(',').map((tag) => tag.trim()) : [],
  })

  res.status(201).json({ message: 'File uploaded', asset })
})

export const getMedia = asyncHandler(async (_req, res) => {
  const assets = await MediaAsset.find().sort({ createdAt: -1 }).populate('uploadedBy', 'name email')
  res.json({ assets })
})

export const deleteMedia = asyncHandler(async (req, res) => {
  const { id } = req.params
  const asset = await MediaAsset.findById(id)

  if (!asset) {
    throw new ApiError(404, 'Asset not found')
  }

  if (asset.publicId) {
    await cloudinary.uploader.destroy(asset.publicId)
  }

  await asset.deleteOne()

  res.json({ message: 'Asset deleted' })
})
