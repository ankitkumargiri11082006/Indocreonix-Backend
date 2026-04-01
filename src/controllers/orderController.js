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

function extractFileExtension(originalname = '') {
  const lowered = originalname.toLowerCase()
  const match = /\.([a-z0-9]+)$/.exec(lowered)
  return match ? match[1] : ''
}

function buildDownloadFilename(originalname = '', fallbackExtension = '') {
  const normalizedExtension = (fallbackExtension || '').replace(/^\./, '')
  const safeBase = (originalname || '').trim() || 'document'
  const sanitized = safeBase.replace(/[^a-z0-9._-]+/gi, '_')

  if (!normalizedExtension) {
    return sanitized
  }

  if (sanitized.toLowerCase().endsWith(`.${normalizedExtension}`)) {
    return sanitized
  }

  return `${sanitized}.${normalizedExtension}`
}

function uploadFileToCloudinary(fileBuffer, originalname, folder) {
  return new Promise((resolve, reject) => {
    const safeBaseName = sanitizeFileBaseName(originalname)
    const extension = extractFileExtension(originalname)
    const timestampedBase = `${safeBaseName}-${Date.now()}`
    const publicId = extension ? `${timestampedBase}.${extension}` : timestampedBase

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'raw',
        public_id: publicId,
        access_control: [{ access_type: 'anonymous' }],
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

function isForcedDownloadUrl(url = '') {
  if (!url) return false
  return /fl_attachment|response-content-disposition=attachment/i.test(url)
}

function getCloudinaryPreviewUrl(publicId, resourceType = 'raw') {
  if (!publicId) return ''
  const extension = extractFileExtension(publicId) || 'bin'
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 6
  try {
    return cloudinary.utils.private_download_url(publicId, extension, {
      resource_type: resourceType,
      type: 'upload',
      expires_at: expiresAt,
      attachment: false,
    })
  } catch {
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'upload',
      secure: true,
    })
  }
}

function getCloudinaryDownloadUrl(publicId, downloadName = '', resourceType = 'raw') {
  if (!publicId) return ''
  const extension = extractFileExtension(downloadName || publicId) || 'bin'
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 6
  try {
    return cloudinary.utils.private_download_url(publicId, extension, {
      resource_type: resourceType,
      type: 'upload',
      expires_at: expiresAt,
      attachment: true,
    })
  } catch {
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'upload',
      secure: true,
      flags: 'attachment',
    })
  }
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
    prdDownloadUrl: '',
    prdPublicId: '',
    prdOriginalName: '',
    prdBytes: 0,
    prdFormat: '',
    prdResourceType: '',
  }

  if (prdFile) {
    const prdExtension = extractFileExtension(prdFile.originalname) || 'pdf'
    const downloadName = buildDownloadFilename(prdFile.originalname, prdExtension)
    const uploadedPrd = await uploadFileToCloudinary(
      prdFile.buffer,
      prdFile.originalname,
      'indocreonix/orders/prd'
    )
    const prdPreviewUrl = uploadedPrd.secure_url || getCloudinaryPreviewUrl(uploadedPrd.public_id)

    prdMeta = {
      prdUrl: prdPreviewUrl,
      prdDownloadUrl: getCloudinaryDownloadUrl(uploadedPrd.public_id, downloadName) || prdPreviewUrl,
      prdPublicId: uploadedPrd.public_id,
      prdOriginalName: prdFile.originalname,
      prdBytes: prdFile.size,
      prdFormat: uploadedPrd.format || prdExtension,
      prdResourceType: 'raw',
    }
  }

  const supportingDocuments = []
  for (const file of supportingFiles) {
    const extension = extractFileExtension(file.originalname)
    const downloadName = buildDownloadFilename(file.originalname, extension)
    const uploadedDocument = await uploadFileToCloudinary(
      file.buffer,
      file.originalname,
      'indocreonix/orders/supporting-docs'
    )
    const documentPreviewUrl = uploadedDocument.secure_url || getCloudinaryPreviewUrl(uploadedDocument.public_id)

    supportingDocuments.push({
      name: file.originalname,
      url: documentPreviewUrl,
      downloadUrl: getCloudinaryDownloadUrl(uploadedDocument.public_id, downloadName) || documentPreviewUrl,
      publicId: uploadedDocument.public_id,
      bytes: file.size,
      format: uploadedDocument.format || extension,
      resourceType: 'raw',
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

  const normalizedItems = items.map((item) => {
    const prdDownloadName = buildDownloadFilename(item.prdOriginalName, item.prdFormat)
    const storedPrdUrl = isForcedDownloadUrl(item.prdUrl) ? '' : item.prdUrl || ''
    const prdResType = item.prdResourceType || 'raw'
    const prdPreviewUrl = getCloudinaryPreviewUrl(item.prdPublicId, prdResType) || storedPrdUrl || ''
    const prdDownloadUrl =
      getCloudinaryDownloadUrl(item.prdPublicId, prdDownloadName, prdResType) ||
      item.prdDownloadUrl ||
      prdPreviewUrl

    return {
      ...item,
      prdUrl: prdPreviewUrl,
      prdDownloadUrl,
      supportingDocuments: (item.supportingDocuments || []).map((document) => {
        const documentDownloadName = buildDownloadFilename(document.name, document.format)
        const storedDocumentUrl = isForcedDownloadUrl(document.url) ? '' : document.url || ''
        const docResType = document.resourceType || 'raw'
        const documentPreviewUrl = getCloudinaryPreviewUrl(document.publicId, docResType) || storedDocumentUrl || ''
        const documentDownloadUrl =
          getCloudinaryDownloadUrl(document.publicId, documentDownloadName, docResType) ||
          document.downloadUrl ||
          documentPreviewUrl

        return {
          ...document,
          url: documentPreviewUrl,
          downloadUrl: documentDownloadUrl,
        }
      }),
    }
  })

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
      await cloudinary.uploader.destroy(item.prdPublicId, { resource_type: item.prdResourceType || 'raw' })
    } catch (err) {
      console.error('[Cloudinary] PRD deletion failed:', err)
    }
  }

  if (item.supportingDocuments?.length) {
    for (const doc of item.supportingDocuments) {
      if (doc.publicId) {
        try {
          await cloudinary.uploader.destroy(doc.publicId, { resource_type: doc.resourceType || 'raw' })
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
      await cloudinary.uploader.destroy(item.prdPublicId, { resource_type: item.prdResourceType || 'raw' })
    } catch (err) {
      console.error('[Cloudinary] PRD deletion failed:', err)
    }
  }

  item.prdUrl = ''
  item.prdDownloadUrl = ''
  item.prdPublicId = ''
  item.prdOriginalName = ''
  item.prdBytes = 0
  item.prdFormat = ''
  item.prdResourceType = ''

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
      await cloudinary.uploader.destroy(document.publicId, { resource_type: document.resourceType || 'raw' })
    } catch (err) {
      console.error(`[Cloudinary] Supporting doc ${document.name} deletion failed:`, err)
    }
  }

  document.deleteOne()
  await item.save()

  res.json({ message: 'Supporting document deleted' })
})
