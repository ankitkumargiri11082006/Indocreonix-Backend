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

function getCloudinaryRawUrl(publicId) {
  if (!publicId) return ''

  return cloudinary.url(publicId, {
    resource_type: 'raw',
    type: 'upload',
    secure: true,
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
  }

  if (prdFile) {
    const uploadedPrd = await uploadRawFileToCloudinary(
      prdFile.buffer,
      prdFile.originalname,
      'indocreonix/orders/prd'
    )

    prdMeta = {
      prdUrl: getCloudinaryRawUrl(uploadedPrd.public_id) || uploadedPrd.secure_url,
      prdPublicId: uploadedPrd.public_id,
      prdOriginalName: prdFile.originalname,
      prdBytes: prdFile.size,
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
      url: getCloudinaryRawUrl(uploadedDocument.public_id) || uploadedDocument.secure_url,
      publicId: uploadedDocument.public_id,
      bytes: file.size,
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
    prdUrl: getCloudinaryRawUrl(item.prdPublicId) || item.prdUrl || '',
    supportingDocuments: (item.supportingDocuments || []).map((document) => ({
      ...document,
      url: getCloudinaryRawUrl(document.publicId) || document.url || '',
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
