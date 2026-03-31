import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { cloudinary } from '../config/cloudinary.js'
import { Opportunity } from '../models/Opportunity.js'
import { CareerApplication } from '../models/CareerApplication.js'
import { AdminAuditLog } from '../models/AdminAuditLog.js'
import { clearCacheByNamespace, getCached, setCached } from '../utils/publicCache.js'
import { sendApplicationConfirmation, sendApplicationNotification, sendStatusUpdateNotification, sendOnboardingDocsRequestEmail } from '../utils/emailService.js'

const OPPORTUNITIES_PUBLIC_CACHE_NAMESPACE = 'careers:opportunities:public'

async function createAuditLog(req, action, entity, entityId = '', metadata = {}) {
  await AdminAuditLog.create({
    actor: {
      id: req.user?._id || null,
      email: req.user?.email || '',
      role: req.user?.role || '',
    },
    action,
    entity,
    entityId: entityId ? String(entityId) : '',
    metadata,
    ip: req.ip || '',
    userAgent: req.get('user-agent') || '',
  })
}

function csvEscape(value) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function sanitizeCvFileBaseName(originalname = '') {
  const withoutExt = originalname.replace(/\.pdf$/i, '')
  const sanitized = withoutExt
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return sanitized || 'cv-file'
}

function getCloudinaryCvUrl(publicId, resourceType = 'image') {
  if (!publicId) return ''

  return cloudinary.url(publicId, {
    resource_type: resourceType,
    secure: true,
    ...(resourceType === 'image' ? { format: 'pdf' } : {}),
  })
}

function getSignedCloudinaryCvUrl(publicId, resourceType = 'image') {
  if (!publicId) return ''

  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60

  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: 'upload',
    secure: true,
    sign_url: true,
    expires_at: expiresAt,
    ...(resourceType === 'image' ? { format: 'pdf' } : {}),
  })
}

function getPrivateDownloadCvUrl(publicId, resourceType = 'image') {
  if (!publicId) return ''

  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60

  return cloudinary.utils.private_download_url(publicId, 'pdf', {
    resource_type: resourceType,
    type: 'upload',
    expires_at: expiresAt,
    attachment: false,
  })
}

async function ensureCvAnonymousDelivery(publicId, resourceType = 'image') {
  try {
    await cloudinary.api.update(publicId, {
      resource_type: resourceType,
      type: 'upload',
      access_control: [{ access_type: 'anonymous' }],
    })
  } catch {
    return
  }
}

async function resolveCloudinaryCvDelivery(publicId, preferredResourceType = 'image') {
  if (!publicId) return ''

  const resourceTypes = preferredResourceType === 'raw' ? ['raw', 'image'] : ['image', 'raw']

  for (const resourceType of resourceTypes) {
    try {
      const resource = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      })

      if (resource?.secure_url) {
        const hasAnonymousAccess = Array.isArray(resource.access_control)
          ? resource.access_control.some((entry) => entry?.access_type === 'anonymous')
          : false

        if (!hasAnonymousAccess) {
          await ensureCvAnonymousDelivery(publicId, resourceType)
        }

        return (
          getPrivateDownloadCvUrl(publicId, resourceType) ||
          getSignedCloudinaryCvUrl(publicId, resourceType) ||
          resource.secure_url
        )
      }
    } catch {
      continue
    }
  }

  return (
    getSignedCloudinaryCvUrl(publicId, preferredResourceType) ||
    getPrivateDownloadCvUrl(publicId, preferredResourceType) ||
    getCloudinaryCvUrl(publicId, preferredResourceType)
  )
}

async function destroyCvAsset(publicId, preferredResourceType = 'image') {
  if (!publicId) return

  const resourceTypes = preferredResourceType === 'raw' ? ['raw', 'image'] : ['image', 'raw']
  for (const resourceType of resourceTypes) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
      if (result?.result === 'ok') {
        return
      }
    } catch {
      continue
    }
  }
}

function uploadPdfToCloudinary(fileBuffer, originalname) {
  return new Promise((resolve, reject) => {
    const safeBaseName = sanitizeCvFileBaseName(originalname)

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'indocreonix/cv',
        resource_type: 'image',
        format: 'pdf',
        access_control: [{ access_type: 'anonymous' }],
        public_id: `cv-${Date.now()}-${safeBaseName}`,
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

export const getPublicOpportunities = asyncHandler(async (req, res) => {
  const { type } = req.query
  const query = { isActive: true }
  if (type) query.type = type

  const cacheKey = type ? String(type) : 'all'
  const cachedItems = getCached(OPPORTUNITIES_PUBLIC_CACHE_NAMESPACE, cacheKey)
  if (cachedItems) {
    return res.json({ items: cachedItems })
  }

  const items = await Opportunity.find(query)
    .sort({ order: 1, createdAt: -1 })
    .select('-__v')
    .lean()

  setCached(OPPORTUNITIES_PUBLIC_CACHE_NAMESPACE, items, {
    key: cacheKey,
    ttlMs: 60_000,
  })

  res.json({ items })
})

export const getAdminOpportunities = asyncHandler(async (_req, res) => {
  const items = await Opportunity.find().sort({ order: 1, createdAt: -1 }).select('-__v').lean()
  res.json({ items })
})

export const createOpportunity = asyncHandler(async (req, res) => {
  const item = await Opportunity.create(req.body)
  clearCacheByNamespace(OPPORTUNITIES_PUBLIC_CACHE_NAMESPACE)
  res.status(201).json({ message: 'Opportunity created', item })
})

export const updateOpportunity = asyncHandler(async (req, res) => {
  const item = await Opportunity.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
  if (!item) throw new ApiError(404, 'Opportunity not found')
  clearCacheByNamespace(OPPORTUNITIES_PUBLIC_CACHE_NAMESPACE)
  res.json({ message: 'Opportunity updated', item })
})

export const deleteOpportunity = asyncHandler(async (req, res) => {
  const item = await Opportunity.findById(req.params.id)
  if (!item) throw new ApiError(404, 'Opportunity not found')
  await item.deleteOne()
  clearCacheByNamespace(OPPORTUNITIES_PUBLIC_CACHE_NAMESPACE)
  res.json({ message: 'Opportunity deleted' })
})

export const submitApplication = asyncHandler(async (req, res) => {
  const {
    roleType,
    opportunityId,
    fullName,
    email,
    phone,
    city,
    qualification,
    skills,
    experience,
    portfolio,
    message,
    consentAccepted,
  } = req.body

  if (!roleType || !fullName || !email || !phone || !city || !qualification || !skills || !experience || !message) {
    throw new ApiError(400, 'Please fill all required fields')
  }

  if (!req.file) {
    throw new ApiError(400, 'CV PDF is required')
  }

  const hasAcceptedConsent = String(consentAccepted).toLowerCase() === 'true'
  if (!hasAcceptedConsent) {
    throw new ApiError(400, 'You must accept Indocreonix Terms and Privacy Policy')
  }

  const uploaded = await uploadPdfToCloudinary(req.file.buffer, req.file.originalname)
  const resolvedCvUrl = uploaded.secure_url || getCloudinaryCvUrl(uploaded.public_id, uploaded.resource_type)

  const item = await CareerApplication.create({
    roleType,
    opportunity: opportunityId || null,
    fullName,
    email,
    phone,
    city,
    qualification,
    skills,
    experience,
    portfolio,
    message,
    consentAccepted: true,
    consentAcceptedAt: new Date(),
    cvUrl: resolvedCvUrl,
    cvPublicId: uploaded.public_id,
    cvResourceType: uploaded.resource_type || 'image',
    cvOriginalName: req.file.originalname,
    cvBytes: req.file.size,
  })

  // ── Fire-and-forget emails ───────────────────────────────────────────────
  const opportunityTitle = opportunityId
    ? (await Opportunity.findById(opportunityId).select('title').lean())?.title || roleType
    : roleType

  const emailData = {
    fullName,
    email,
    phone,
    city,
    roleType,
    opportunityTitle,
    experience,
    qualification,
    skills,
    portfolio,
    message,
  }

  // Confirmation to applicant (from careers@indocreonix.com)
  sendApplicationConfirmation(email, emailData).catch((err) =>
    console.error('[Email] Application confirmation failed:', err.message)
  )

  // Notification to internal HR / careers inbox
  sendApplicationNotification(emailData).catch((err) =>
    console.error('[Email] Application notification failed:', err.message)
  )

  res.status(201).json({ message: 'Application submitted successfully', itemId: item._id })
})

export const getApplications = asyncHandler(async (req, res) => {
  const { roleType, status } = req.query
  const query = {}
  if (roleType) query.roleType = roleType
  if (status) query.status = status

  const items = await CareerApplication.find(query)
    .populate('opportunity', 'title type')
    .sort({ createdAt: -1 })
    .lean()

  const normalizedItems = await Promise.all(
    items.map(async (item) => ({
      ...item,
      cvUrl:
        (item.cvPublicId
          ? await resolveCloudinaryCvDelivery(item.cvPublicId, item.cvResourceType || 'raw')
          : '') ||
        item.cvUrl ||
        '',
    }))
  )

  await CareerApplication.updateMany(
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

export const exportApplicationsCsv = asyncHandler(async (req, res) => {
  const { roleType, status } = req.query
  const query = {}
  if (roleType) query.roleType = roleType
  if (status) query.status = status

  const items = await CareerApplication.find(query)
    .populate('opportunity', 'title type')
    .sort({ createdAt: -1 })

  const headers = [
    'Name',
    'Type',
    'Opening',
    'Email',
    'Phone',
    'City',
    'Qualification',
    'Skills',
    'Experience',
    'Portfolio',
    'Status',
    'CV URL',
    'Admin Notes',
    'Applied At',
  ]

  const rows = items.map((item) => [
    item.fullName,
    item.roleType,
    item.opportunity?.title || 'General',
    item.email,
    item.phone,
    item.city,
    item.qualification,
    item.skills,
    item.experience,
    item.portfolio,
    item.status,
    item.cvUrl,
    item.adminNotes,
    item.createdAt ? new Date(item.createdAt).toISOString() : '',
  ])

  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')

  await createAuditLog(req, 'EXPORT_CAREER_APPLICATIONS_CSV', 'CareerApplication', '', {
    count: items.length,
    filters: { roleType: roleType || '', status: status || '' },
  })

  const date = new Date().toISOString().slice(0, 10)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename=career-applications-${date}.csv`)
  res.status(200).send(csv)
})

export const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body
  const item = await CareerApplication.findById(req.params.id)

  if (!item) throw new ApiError(404, 'Application not found')

  const previousStatus = item.status
  if (status) item.status = status
  if (typeof adminNotes === 'string') item.adminNotes = adminNotes
  if (item.isUnreadForAdmin) {
    item.isUnreadForAdmin = false
    item.lastViewedByAdminAt = new Date()
  }

  await item.save()

  await createAuditLog(req, 'UPDATE_CAREER_APPLICATION', 'CareerApplication', item._id, {
    status: item.status,
    hasAdminNotes: Boolean(item.adminNotes),
  })

  // Notify the candidate when status changes (reviewing / shortlisted / hired)
  if (item.status !== previousStatus) {
    sendStatusUpdateNotification(item.email, item.status, {
      fullName: item.fullName,
      opportunityTitle: item.opportunity?.title || item.roleType,
    }).catch((err) => {
      console.error('[Email] Status update notification failed:', err.message)
    })
  }

  res.json({ message: 'Application updated', item })
})

export const requestOnboardingDocs = asyncHandler(async (req, res) => {
  const item = await CareerApplication.findById(req.params.id).populate('opportunity', 'title')
  if (!item) throw new ApiError(404, 'Application not found')

  const actionUrl = `${process.env.FRONTEND_URL || 'https://indocreonix.com'}/career/onboarding-documents?token=${item._id}`

  await sendOnboardingDocsRequestEmail(item.email, {
    fullName: item.fullName,
    opportunityTitle: item.opportunity?.title || item.roleType,
    actionUrl,
  }).catch((err) => {
    console.error('[Email] Onboarding docs request failed:', err.message)
    throw new ApiError(500, 'Failed to send onboarding documents request')
  })

  await createAuditLog(req, 'REQUEST_ONBOARDING_DOCUMENTS', 'CareerApplication', item._id, {
    email: item.email,
    actionUrl,
  })

  res.json({ message: 'Onboarding docs request email sent' })
})

export const submitOnboardingDocs = asyncHandler(async (req, res) => {
  const item = await CareerApplication.findById(req.params.id)
  if (!item) throw new ApiError(404, 'Application not found')

  const file = req.file
  if (!file) {
    throw new ApiError(400, 'No PDF uploaded. Please attach your onboarding documents PDF.')
  }

  // Upload to Cloudinary exactly like CV — resource_type:'image', format:'pdf', anonymous access
  const safeBaseName = file.originalname
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)

  const uploadResult = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'indocreonix/onboarding-docs',
        resource_type: 'image',
        format: 'pdf',
        public_id: `docs-${item._id}-${Date.now()}-${safeBaseName}`,
        use_filename: false,
        unique_filename: false,
        overwrite: false,
        access_control: [{ access_type: 'anonymous' }],
      },
      (error, result) => {
        if (error) return reject(error)
        return resolve(result)
      }
    )
    stream.end(file.buffer)
  })

  item.onboardingDocsUrl = uploadResult.secure_url || uploadResult.url
  item.onboardingDocsPublicId = uploadResult.public_id
  item.onboardingDocsResourceType = 'image'
  item.onboardingDocsSubmittedAt = new Date()
  await item.save()

  await createAuditLog(req, 'SUBMIT_ONBOARDING_DOCS', 'CareerApplication', item._id, {
    url: item.onboardingDocsUrl,
  })

  res.json({ message: 'Onboarding documents submitted successfully' })
})





export const deleteApplication = asyncHandler(async (req, res) => {
  const item = await CareerApplication.findById(req.params.id)

  if (!item) throw new ApiError(404, 'Application not found')

  if (item.cvPublicId) {
    await destroyCvAsset(item.cvPublicId, item.cvResourceType || 'raw')
  }

  await item.deleteOne()

  await createAuditLog(req, 'DELETE_CAREER_APPLICATION', 'CareerApplication', req.params.id, {
    roleType: item.roleType,
    hadCv: Boolean(item.cvPublicId),
  })

  res.json({ message: 'Application deleted' })
})
