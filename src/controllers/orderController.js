import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { cloudinary } from '../config/cloudinary.js'
import { ProjectOrder } from '../models/ProjectOrder.js'
import { sendOrderConfirmation, sendOrderNotification } from '../utils/emailService.js'

function sanitizeFileBaseName(originalname = '') {
  const withoutExt = originalname.replace(/\.[^/.]+$/, '')
  const sanitized = withoutExt
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return sanitized || 'document'
}

function uploadRawFileToCloudinary(fileBuffer, originalname, folder) {
  return new Promise((resolve, reject) => {
    const safeBaseName = sanitizeFileBaseName(originalname)

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'raw',
        public_id: `${safeBaseName}-${Date.now()}`,
        use_filename: false,
        unique_filename: false,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error)
        return resolve(result)
      }
    )

    uploadStream.end(fileBuffer)
  })
}

function getCloudinaryRawUrl(publicId, format = '') {
  if (!publicId) return ''

  return cloudinary.url(publicId, {
    resource_type: 'raw',
    type: 'upload',
    secure: true,
    ...(format ? { format } : {}),
  })
}

export const createProjectOrder = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    phone,
    company,
    targetBudget,
    targetTimeline,
    projectCategory,
    projectSubtype,
    requestedService,
    requestedProduct,
    projectReference,
    businessGoals,
    projectSummary,
    featureRequirements,
  } = req.body

  if (!fullName || !email || !phone || !projectCategory || !businessGoals || !projectSummary) {
    throw new ApiError(400, 'Please complete all required fields')
  }

  if (projectCategory !== 'other' && !String(projectSubtype || '').trim()) {
    throw new ApiError(400, 'Please select a valid project subtype')
  }

  const prdFile = req.files?.prd?.[0]
  const supportingFiles = req.files?.supportingDocs || []

  let prdMeta = {
    prdUrl: '',
    prdPublicId: '',
    prdOriginalName: '',
    prdBytes: 0,
    prdFormat: '',
  }

  if (prdFile) {
    const uploadedPrd = await uploadRawFileToCloudinary(
      prdFile.buffer,
      prdFile.originalname,
      'indocreonix/orders/prd'
    )

    prdMeta = {
      prdUrl: getCloudinaryRawUrl(uploadedPrd.public_id, uploadedPrd.format) || uploadedPrd.secure_url,
      prdPublicId: uploadedPrd.public_id,
      prdOriginalName: prdFile.originalname,
      prdBytes: prdFile.size,
      prdFormat: uploadedPrd.format || '',
    }
  }

  const supportingDocuments = []
  for (const file of supportingFiles) {
    const uploadedDocument = await uploadRawFileToCloudinary(
      file.buffer,
      file.originalname,
      'indocreonix/orders/supporting-docs'
    )

    supportingDocuments.push({
      name: file.originalname,
      url: getCloudinaryRawUrl(uploadedDocument.public_id, uploadedDocument.format) || uploadedDocument.secure_url,
      publicId: uploadedDocument.public_id,
      bytes: file.size,
      format: uploadedDocument.format || '',
    })
  }

  const item = await ProjectOrder.create({
    fullName,
    email,
    phone,
    company,
    targetBudget,
    targetTimeline,
    projectCategory,
    projectSubtype,
    requestedService,
    requestedProduct,
    projectReference,
    businessGoals,
    projectSummary,
    featureRequirements,
    ...prdMeta,
    supportingDocuments,
  })

  // Send Emails (Non-blocking)
  sendOrderConfirmation(email, item).catch(err => console.error('[Order Email] Confirmation failed:', err))
  sendOrderNotification(item).catch(err => console.error('[Order Email] Notification failed:', err))

  res.status(201).json({
    message: 'Your project request has been submitted successfully',
    itemId: item._id,
  })
})

export const getProjectOrders = asyncHandler(async (_req, res) => {
  const items = await ProjectOrder.find().sort({ createdAt: -1 }).lean()

  const normalizedItems = items.map((item) => ({
    ...item,
    prdUrl: getCloudinaryRawUrl(item.prdPublicId, item.prdFormat) || item.prdUrl || '',
    supportingDocuments: (item.supportingDocuments || []).map((document) => ({
      ...document,
      url: getCloudinaryRawUrl(document.publicId, document.format) || document.url || '',
    })),
  }))

  await ProjectOrder.updateMany(
    { isUnreadForAdmin: true },
    {
      $set: {
        isUnreadForAdmin: false,
        lastViewedByAdminAt: new Date(),
      },
    }
  )

  res.json({ items: normalizedItems })
})

export const updateProjectOrder = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body
  const item = await ProjectOrder.findById(req.params.id)

  if (!item) {
    throw new ApiError(404, 'Order request not found')
  }

  if (status) item.status = status
  if (typeof adminNotes === 'string') item.adminNotes = adminNotes
  if (item.isUnreadForAdmin) {
    item.isUnreadForAdmin = false
    item.lastViewedByAdminAt = new Date()
  }

  await item.save()
 
   res.json({ message: 'Order request updated', item })
 })
 
export const deleteProjectOrder = asyncHandler(async (req, res) => {
  const item = await ProjectOrder.findById(req.params.id)

  if (!item) {
    throw new ApiError(404, 'Order request not found')
  }

  // Delete files from Cloudinary
  if (item.prdPublicId) {
    try {
      await cloudinary.uploader.destroy(item.prdPublicId, { resource_type: 'raw' })
    } catch (err) {
      console.error('[Cloudinary] PRD deletion failed:', err)
    }
  }

  if (item.supportingDocuments?.length) {
    for (const doc of item.supportingDocuments) {
      if (doc.publicId) {
        try {
          await cloudinary.uploader.destroy(doc.publicId, { resource_type: 'raw' })
        } catch (err) {
          console.error(`[Cloudinary] Supporting doc ${doc.name} deletion failed:`, err)
        }
      }
    }
  }

  await item.deleteOne()

  res.json({ message: 'Order request deleted' })
})

export const deleteProjectOrderPrd = asyncHandler(async (req, res) => {
  const item = await ProjectOrder.findById(req.params.id)

  if (!item) {
    throw new ApiError(404, 'Order request not found')
  }

  if (item.prdPublicId) {
    try {
      await cloudinary.uploader.destroy(item.prdPublicId, { resource_type: 'raw' })
    } catch (err) {
      console.error('[Cloudinary] PRD deletion failed:', err)
    }
  }

  item.prdUrl = ''
  item.prdPublicId = ''
  item.prdOriginalName = ''
  item.prdBytes = 0
  item.prdFormat = ''

  await item.save()

  res.json({ message: 'PRD deleted' })
})

export const deleteProjectOrderSupportingDocument = asyncHandler(async (req, res) => {
  const item = await ProjectOrder.findById(req.params.id)

  if (!item) {
    throw new ApiError(404, 'Order request not found')
  }

  const document = item.supportingDocuments.id(req.params.documentId)

  if (!document) {
    throw new ApiError(404, 'Supporting document not found')
  }

  if (document.publicId) {
    try {
      await cloudinary.uploader.destroy(document.publicId, { resource_type: 'raw' })
    } catch (err) {
      console.error(`[Cloudinary] Supporting doc ${document.name} deletion failed:`, err)
    }
  }

  document.deleteOne()
  await item.save()

  res.json({ message: 'Supporting document deleted' })
})
