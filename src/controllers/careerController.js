import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { cloudinary } from '../config/cloudinary.js'
import { Opportunity } from '../models/Opportunity.js'
import { CareerApplication } from '../models/CareerApplication.js'
import { AdminAuditLog } from '../models/AdminAuditLog.js'
import { clearCacheByNamespace, getCached, setCached } from '../utils/publicCache.js'
import {
  sendApplicationConfirmation,
  sendApplicationNotification,
  sendStatusUpdateNotification,
  sendOnboardingDocsRequestEmail,
  sendOfferLetterIssuedEmail,
  sendCertificateIssuedEmail,
} from '../utils/emailService.js'

const OPPORTUNITIES_PUBLIC_CACHE_NAMESPACE = 'careers:opportunities:public'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const COMPANY_LETTERHEAD_BACKGROUND_PATH = path.resolve(__dirname, '../../assets/offer-letter-letterhead.png')
const LETTERHEAD_SAFE_AREA = {
  top: 270,
  right: 80,
  bottom: 168,
  left: 80,
}

function applyCompanyLetterhead(doc) {
  if (fs.existsSync(COMPANY_LETTERHEAD_BACKGROUND_PATH)) {
    doc.image(COMPANY_LETTERHEAD_BACKGROUND_PATH, 0, 0, {
      width: doc.page.width,
      height: doc.page.height,
    })
  }
}

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

function uploadPdfToCloudinary(fileBuffer, originalname, options = {}) {
  return new Promise((resolve, reject) => {
    const safeBaseName = sanitizeCvFileBaseName(originalname)
    const {
      folder = 'indocreonix/cv',
      publicIdPrefix = 'cv',
      resourceType = 'image',
      accessControl = [{ access_type: 'anonymous' }],
      extraUploadOptions = {},
    } = options

    const uploadOptions = {
      folder,
      resource_type: resourceType,
      public_id: `${publicIdPrefix}-${Date.now()}-${safeBaseName}`,
      use_filename: false,
      unique_filename: false,
      overwrite: false,
      ...extraUploadOptions,
    }

    if (Array.isArray(accessControl) && accessControl.length) {
      uploadOptions.access_control = accessControl
    }

    if (resourceType === 'image') {
      uploadOptions.format = 'pdf'
    }

    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error)
      return resolve(result)
    })

    uploadStream.end(fileBuffer)
  })
}

function formatDateText(value) {
  if (!value) return ''

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return String(value)
  }

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function createReferenceSuffix(seed) {
  const text = String(seed || '')
  let hash = 0

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0
  }

  return String((Math.abs(hash) % 9000) + 1000).padStart(4, '0')
}

function buildDocumentReference(application, documentKind) {
  const roleSeries = application.roleType === 'internship' ? 'INT' : 'JOB'
  const docSeries = documentKind === 'offer' ? 'OFR' : 'CRT'
  const year = new Date().getFullYear()
  const suffix = createReferenceSuffix(
    `${application._id}|${application.email}|${application.phone}|${application.createdAt}|${documentKind}`
  )

  return `IND/${roleSeries}/${docSeries}/${year}/${suffix}`
}

function buildOfferLetterPdfBuffer(payload) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: LETTERHEAD_SAFE_AREA,
    })
    const chunks = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    applyCompanyLetterhead(doc)
    doc.y = LETTERHEAD_SAFE_AREA.top - 8

    const fullName = payload.candidateName || 'Candidate'
    const firstName = String(fullName).trim().split(/\s+/)[0] || 'Candidate'
    const roleTitle = payload.role || 'Intern'
    const joiningDate = payload.startDate || 'the agreed date'
    const duration = payload.duration || 'the agreed period'
    const stipend = payload.stipend || 'As discussed'
    const referenceNumber = payload.refNumber || 'IND/INT/OFR/2026/1000'
    const effectiveDate = formatDateText(new Date())

    const contentLeft = doc.page.margins.left
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const verticalShift = -70
    const templateRefRowY = 224 + verticalShift
    const titleY = 254 + verticalShift

    doc.font('Times-Bold').fontSize(24).fillColor('#0f172a').text('OFFER LETTER', contentLeft, titleY, {
      width: contentWidth,
      align: 'center',
    })

    // Template already prints "REF NO." and "DATE:" labels in header row.
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(referenceNumber, contentLeft + 20, templateRefRowY, {
      width: Math.floor(contentWidth * 0.46),
      align: 'left',
    })
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(effectiveDate, contentLeft, templateRefRowY, {
      width: contentWidth - 4,
      align: 'right',
    })

    const recipientY = titleY + 34
    doc.font('Helvetica').fontSize(11).fillColor('#334155').text('To,', contentLeft, recipientY)
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(fullName, contentLeft, recipientY + 16)
    if (payload.candidateAddress) {
      doc.font('Helvetica').fontSize(11).fillColor('#334155').text(payload.candidateAddress, contentLeft, recipientY + 33, {
        width: Math.round(contentWidth * 0.58),
      })
    }

    doc.y = recipientY + 50
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(`Subject: Internship Offer - ${roleTitle}`, contentLeft, doc.y, {
      width: contentWidth,
    })

    doc.y += 20
    doc.font('Helvetica').fontSize(11).fillColor('#1f2937').text(`Dear ${firstName},`, contentLeft, doc.y)
    doc.y += 18

    doc.font('Helvetica').fontSize(11).fillColor('#1f2937').text(
      `We are pleased to offer you the position of ${roleTitle} at Indocreonix. ` +
        `Your engagement will commence on ${joiningDate} for a duration of ${duration}. ` +
        `You will receive a stipend/compensation of ${stipend}.`,
      contentLeft,
      doc.y,
      {
        width: contentWidth,
        align: 'justify',
        lineGap: 2,
      }
    )

    doc.moveDown(0.9)
    doc.text(
      'During your engagement, you are expected to uphold company policies, maintain confidentiality, and perform your assigned responsibilities with professionalism and integrity.',
      {
        width: contentWidth,
        align: 'justify',
        lineGap: 2,
      }
    )

    doc.moveDown(0.9)
    doc.text(
      'Your reporting structure, key responsibilities, and initial goals will be shared by your reporting manager during onboarding to help you begin effectively from day one.',
      {
        width: contentWidth,
        align: 'justify',
        lineGap: 2,
      }
    )

    doc.moveDown(0.8)
    doc.text(
      'Performance reviews will be conducted periodically, and any role-related updates will be communicated formally by the company as part of your professional development journey.',
      {
        width: contentWidth,
        align: 'justify',
        lineGap: 2,
      }
    )

    doc.moveDown(0.8)
    doc.text(
      'Please confirm your acceptance of this offer by replying to the HR team. We look forward to welcoming you to Indocreonix and building a successful professional association together.',
      {
        width: contentWidth,
        align: 'justify',
        lineGap: 2,
      }
    )

    doc.moveDown(0.6)
    doc.font('Helvetica-Oblique').fontSize(10).fillColor('#475569').text('This offer is subject to company terms, policies, and applicable regulations.', {
      width: contentWidth,
      align: 'left',
    })
    doc.font('Helvetica').fontSize(11).fillColor('#1f2937')

    doc.moveDown(1.6)
    const summaryY = doc.y
    const summaryHeight = 62
    doc.roundedRect(contentLeft, summaryY, contentWidth, summaryHeight, 6).fillAndStroke('#f8fafc', '#e2e8f0')

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('Offer Summary', contentLeft + 12, summaryY + 10)
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(
      `Role: ${roleTitle}   |   Start Date: ${joiningDate}   |   Duration: ${duration}   |   Stipend: ${stipend}`,
      contentLeft + 12,
      summaryY + 26,
      {
        width: contentWidth - 24,
        lineGap: 2,
      }
    )

    doc.y = summaryY + summaryHeight + 6

    doc.end()
  })
}

function buildCertificatePdfBuffer(payload) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margins: LETTERHEAD_SAFE_AREA,
    })
    const chunks = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    applyCompanyLetterhead(doc)
    doc.y = LETTERHEAD_SAFE_AREA.top - 2

    const contentLeft = doc.page.margins.left
    const contentTop = doc.page.margins.top
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const fullName = payload.fullName || 'Candidate Name'
    const courseTitle = payload.courseTitle || 'Program'
    const completionDate = payload.completionDate || formatDateText(new Date())
    const referenceNumber = payload.refNumber || 'IND/INT/CRT/2026/1000'

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(`Ref No: ${referenceNumber}`, contentLeft, contentTop, {
      width: contentWidth,
      align: 'right',
    })
    doc.font('Helvetica-Bold').fontSize(28).fillColor('#14532d').text('Certificate of Achievement', contentLeft, contentTop + 16, {
      width: contentWidth,
      align: 'center',
    })
    doc.moveDown(0.8)

    doc.font('Helvetica').fontSize(12).fillColor('#334155').text('This certificate is proudly presented to', {
      width: contentWidth,
      align: 'center',
    })
    doc.moveDown(0.6)

    doc.font('Helvetica-Bold').fontSize(30).fillColor('#0f172a').text(fullName, {
      width: contentWidth,
      align: 'center',
    })

    doc.moveDown(0.8)
    doc.font('Helvetica').fontSize(13).fillColor('#1f2937').text('For successfully completing', {
      width: contentWidth,
      align: 'center',
    })
    doc.moveDown(0.5)

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#166534').text(courseTitle, {
      width: contentWidth,
      align: 'center',
    })

    doc.moveDown(1.8)
    doc.font('Helvetica').fontSize(11).fillColor('#334155').text(`Completion Date: ${completionDate}`, contentLeft, doc.y, {
      width: contentWidth,
      align: 'center',
    })

    doc.moveDown(1.4)
    doc.moveTo(contentLeft, doc.y).lineTo(contentLeft + contentWidth, doc.y).lineWidth(0.8).strokeColor('#cbd5e1').stroke()
    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Authorized by Indocreonix', {
      width: contentWidth,
      align: 'center',
    })

    doc.end()
  })
}

function normalizeOfferLetterPayload(application, payload = {}) {
  const existing = application.offerLetter || {}
  return {
    candidateName: String(payload.candidateName || existing.candidateName || application.fullName || '').trim(),
    candidateAddress: String(payload.candidateAddress || existing.candidateAddress || application.city || '').trim(),
    role: String(payload.role || existing.role || application.opportunity?.title || application.roleType || '').trim(),
    startDate: String(payload.startDate || existing.startDate || '').trim(),
    duration: String(payload.duration || existing.duration || '').trim(),
    stipend: String(payload.stipend || existing.stipend || '').trim(),
    managerName: String(payload.managerName || existing.managerName || 'Indocreonix HR').trim(),
    managerTitle: String(payload.managerTitle || existing.managerTitle || 'Human Resources').trim(),
    refNumber: String(payload.refNumber || existing.refNumber || buildDocumentReference(application, 'offer')).trim(),
  }
}

function normalizeCertificatePayload(application, payload = {}) {
  const existing = application.certificate || {}

  return {
    fullName: String(payload.fullName || existing.fullName || application.fullName || '').trim(),
    courseTitle: String(payload.courseTitle || existing.courseTitle || application.opportunity?.title || 'Internship Program').trim(),
    completionDate: String(payload.completionDate || existing.completionDate || formatDateText(new Date())).trim(),
    refNumber: String(payload.refNumber || existing.refNumber || existing.certificateId || buildDocumentReference(application, 'certificate')).trim(),
  }
}

function applyApprovalState(target, approved, notes, actorEmail) {
  target.isApproved = approved
  target.approvedAt = approved ? new Date() : null
  target.approvedByEmail = approved ? actorEmail : ''
  target.approvalNotes = typeof notes === 'string' ? notes.trim() : target.approvalNotes || ''
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
      onboardingDocsUrl:
        (item.onboardingDocsPublicId
          ? await resolveCloudinaryCvDelivery(
              item.onboardingDocsPublicId,
              item.onboardingDocsResourceType || 'raw'
            )
          : '') ||
        item.onboardingDocsUrl ||
        '',
      offerLetter: {
        ...(item.offerLetter || {}),
        url:
          (item.offerLetter?.publicId
            ? await resolveCloudinaryCvDelivery(
                item.offerLetter.publicId,
                item.offerLetter.resourceType || 'raw'
              )
            : '') || item.offerLetter?.url || '',
      },
      certificate: {
        ...(item.certificate || {}),
        url:
          (item.certificate?.publicId
            ? await resolveCloudinaryCvDelivery(
                item.certificate.publicId,
                item.certificate.resourceType || 'raw'
              )
            : '') || item.certificate?.url || '',
      },
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

  const baseUrl = process.env.FRONTEND_URL || 'https://indocreonix.com'
  const actionUrl = `${baseUrl}/career/onboarding-documents?token=${encodeURIComponent(String(item._id))}`

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
  if (!req.file) {
    throw new ApiError(400, 'Please upload a single PDF document')
  }

  const application = await CareerApplication.findById(req.params.id)
  if (!application) {
    throw new ApiError(404, 'Application not found or link expired')
  }

  const uploaded = await uploadPdfToCloudinary(req.file.buffer, req.file.originalname, {
    folder: 'indocreonix/onboarding-docs',
    publicIdPrefix: 'onboarding',
    resourceType: 'image',
  })

  if (application.onboardingDocsPublicId) {
    await destroyCvAsset(application.onboardingDocsPublicId, application.onboardingDocsResourceType || 'raw')
  }

  const resolvedUrl =
    uploaded.secure_url ||
    getCloudinaryCvUrl(uploaded.public_id, uploaded.resource_type || 'raw') ||
    ''

  application.onboardingDocsUrl = resolvedUrl
  application.onboardingDocsPublicId = uploaded.public_id
  application.onboardingDocsResourceType = uploaded.resource_type || 'image'
  application.onboardingDocsSubmittedAt = new Date()
  application.onboardingDocsOriginalName = req.file.originalname || ''
  application.onboardingDocsBytes = req.file.size || 0
  application.isUnreadForAdmin = true

  await application.save()

  await createAuditLog(req, 'SUBMIT_ONBOARDING_DOCUMENTS', 'CareerApplication', application._id, {
    hasDocument: true,
  })

  res.json({ message: 'Onboarding document uploaded successfully' })
})

export const deleteOnboardingDocs = asyncHandler(async (req, res) => {
  const application = await CareerApplication.findById(req.params.id)
  if (!application) {
    throw new ApiError(404, 'Application not found')
  }

  const hadDocument = Boolean(application.onboardingDocsPublicId)

  if (hadDocument) {
    await destroyCvAsset(application.onboardingDocsPublicId, application.onboardingDocsResourceType || 'raw')
  }

  application.onboardingDocsUrl = ''
  application.onboardingDocsPublicId = ''
  application.onboardingDocsResourceType = 'image'
  application.onboardingDocsSubmittedAt = null
  application.onboardingDocsOriginalName = ''
  application.onboardingDocsBytes = 0
  await application.save()

  await createAuditLog(req, 'DELETE_ONBOARDING_DOCUMENTS', 'CareerApplication', application._id, {
    removedFromCloudinary: hadDocument,
  })

  res.json({ message: 'Onboarding document deleted' })
})

export const sendOfferLetter = asyncHandler(async (req, res) => {
  const item = await CareerApplication.findById(req.params.id).populate('opportunity', 'title')
  if (!item) throw new ApiError(404, 'Application not found')

  const offerPayload = normalizeOfferLetterPayload(item, req.body || {})
  if (!offerPayload.candidateName || !offerPayload.role) {
    throw new ApiError(400, 'Candidate name and role are required to generate offer letter')
  }

  const pdfBuffer = await buildOfferLetterPdfBuffer(offerPayload)
  const uploaded = await uploadPdfToCloudinary(
    pdfBuffer,
    `${offerPayload.candidateName || item.fullName}-offer-letter.pdf`,
    {
      folder: 'indocreonix/career-documents/offer-letters',
      publicIdPrefix: 'offer-letter',
      resourceType: 'raw',
      accessControl: null,
      extraUploadOptions: {
        format: 'pdf',
      },
    }
  )

  if (item.offerLetter?.publicId) {
    await destroyCvAsset(item.offerLetter.publicId, item.offerLetter.resourceType || 'raw')
  }

  item.offerLetter = {
    ...offerPayload,
    publicId: uploaded.public_id,
    resourceType: uploaded.resource_type || 'raw',
    url: uploaded.secure_url || getCloudinaryCvUrl(uploaded.public_id, uploaded.resource_type || 'raw'),
    sentAt: new Date(),
    sentByEmail: req.user?.email || '',
    isApproved: false,
    approvedAt: null,
    approvedByEmail: '',
    approvalNotes: '',
  }

  item.isUnreadForAdmin = false
  await item.save()

  const baseUrl = process.env.FRONTEND_URL || 'https://indocreonix.com'
  sendOfferLetterIssuedEmail(item.email, {
    fullName: item.fullName,
    opportunityTitle: item.opportunity?.title || item.roleType,
    portalUrl: `${baseUrl}/portal`,
  }).catch((err) => console.error('[Email] Offer letter issue notification failed:', err.message))

  await createAuditLog(req, 'SEND_OFFER_LETTER', 'CareerApplication', item._id, {
    email: item.email,
    role: offerPayload.role,
  })

  res.json({ message: 'Offer letter generated and sent for review', item })
})

export const sendCertificate = asyncHandler(async (req, res) => {
  const item = await CareerApplication.findById(req.params.id).populate('opportunity', 'title')
  if (!item) throw new ApiError(404, 'Application not found')

  const certificatePayload = normalizeCertificatePayload(item, req.body || {})
  if (!certificatePayload.fullName || !certificatePayload.courseTitle) {
    throw new ApiError(400, 'Candidate name and course title are required to generate certificate')
  }

  const pdfBuffer = await buildCertificatePdfBuffer(certificatePayload)
  const uploaded = await uploadPdfToCloudinary(
    pdfBuffer,
    `${certificatePayload.fullName || item.fullName}-certificate.pdf`,
    {
      folder: 'indocreonix/career-documents/certificates',
      publicIdPrefix: 'certificate',
      resourceType: 'raw',
      accessControl: null,
      extraUploadOptions: {
        format: 'pdf',
      },
    }
  )

  if (item.certificate?.publicId) {
    await destroyCvAsset(item.certificate.publicId, item.certificate.resourceType || 'raw')
  }

  item.certificate = {
    ...certificatePayload,
    certificateId: certificatePayload.refNumber,
    publicId: uploaded.public_id,
    resourceType: uploaded.resource_type || 'raw',
    url: uploaded.secure_url || getCloudinaryCvUrl(uploaded.public_id, uploaded.resource_type || 'raw'),
    sentAt: new Date(),
    sentByEmail: req.user?.email || '',
    isApproved: false,
    approvedAt: null,
    approvedByEmail: '',
    approvalNotes: '',
  }

  item.isUnreadForAdmin = false
  await item.save()

  const baseUrl = process.env.FRONTEND_URL || 'https://indocreonix.com'
  sendCertificateIssuedEmail(item.email, {
    fullName: item.fullName,
    portalUrl: `${baseUrl}/portal`,
  }).catch((err) => console.error('[Email] Certificate issue notification failed:', err.message))

  await createAuditLog(req, 'SEND_CERTIFICATE', 'CareerApplication', item._id, {
    email: item.email,
    refNumber: certificatePayload.refNumber,
  })

  res.json({ message: 'Certificate generated and sent for review', item })
})

export const updateOfferLetterApproval = asyncHandler(async (req, res) => {
  const item = await CareerApplication.findById(req.params.id)
  if (!item) throw new ApiError(404, 'Application not found')

  if (!item.offerLetter?.publicId) {
    throw new ApiError(400, 'Offer letter is not generated yet')
  }

  const approved = Boolean(req.body?.approved)
  applyApprovalState(item.offerLetter, approved, req.body?.notes, req.user?.email || '')
  await item.save()

  await createAuditLog(req, 'APPROVE_OFFER_LETTER', 'CareerApplication', item._id, {
    approved,
    approvedBy: req.user?.email || '',
  })

  res.json({ message: approved ? 'Offer letter approved' : 'Offer letter approval revoked', item })
})

export const updateCertificateApproval = asyncHandler(async (req, res) => {
  const item = await CareerApplication.findById(req.params.id)
  if (!item) throw new ApiError(404, 'Application not found')

  if (!item.certificate?.publicId) {
    throw new ApiError(400, 'Certificate is not generated yet')
  }

  const approved = Boolean(req.body?.approved)
  applyApprovalState(item.certificate, approved, req.body?.notes, req.user?.email || '')
  await item.save()

  await createAuditLog(req, 'APPROVE_CERTIFICATE', 'CareerApplication', item._id, {
    approved,
    approvedBy: req.user?.email || '',
  })

  res.json({ message: approved ? 'Certificate approved' : 'Certificate approval revoked', item })
})

export const deleteOfferLetter = asyncHandler(async (req, res) => {
  const item = await CareerApplication.findById(req.params.id)
  if (!item) throw new ApiError(404, 'Application not found')

  if (!item.offerLetter?.publicId) {
    throw new ApiError(400, 'Offer letter is not generated yet')
  }

  await destroyCvAsset(item.offerLetter.publicId, item.offerLetter.resourceType || 'raw')

  item.offerLetter = {
    refNumber: '',
    candidateName: '',
    candidateAddress: '',
    role: '',
    startDate: '',
    duration: '',
    stipend: '',
    managerName: '',
    managerTitle: '',
    publicId: '',
    resourceType: 'raw',
    url: '',
    sentAt: null,
    sentByEmail: '',
    isApproved: false,
    approvedAt: null,
    approvedByEmail: '',
    approvalNotes: '',
  }

  await item.save()

  await createAuditLog(req, 'DELETE_OFFER_LETTER', 'CareerApplication', item._id, {
    deletedBy: req.user?.email || '',
  })

  res.json({ message: 'Offer letter deleted', item })
})

export const deleteCertificate = asyncHandler(async (req, res) => {
  const item = await CareerApplication.findById(req.params.id)
  if (!item) throw new ApiError(404, 'Application not found')

  if (!item.certificate?.publicId) {
    throw new ApiError(400, 'Certificate is not generated yet')
  }

  await destroyCvAsset(item.certificate.publicId, item.certificate.resourceType || 'raw')

  item.certificate = {
    refNumber: '',
    fullName: '',
    courseTitle: '',
    completionDate: '',
    certificateId: '',
    publicId: '',
    resourceType: 'raw',
    url: '',
    sentAt: null,
    sentByEmail: '',
    isApproved: false,
    approvedAt: null,
    approvedByEmail: '',
    approvalNotes: '',
  }

  await item.save()

  await createAuditLog(req, 'DELETE_CERTIFICATE', 'CareerApplication', item._id, {
    deletedBy: req.user?.email || '',
  })

  res.json({ message: 'Certificate deleted', item })
})

export const deleteApplication = asyncHandler(async (req, res) => {
  const item = await CareerApplication.findById(req.params.id)

  if (!item) throw new ApiError(404, 'Application not found')

  if (item.cvPublicId) {
    await destroyCvAsset(item.cvPublicId, item.cvResourceType || 'raw')
  }

  if (item.onboardingDocsPublicId) {
    await destroyCvAsset(item.onboardingDocsPublicId, item.onboardingDocsResourceType || 'raw')
  }

  if (item.offerLetter?.publicId) {
    await destroyCvAsset(item.offerLetter.publicId, item.offerLetter.resourceType || 'raw')
  }

  if (item.certificate?.publicId) {
    await destroyCvAsset(item.certificate.publicId, item.certificate.resourceType || 'raw')
  }

  await item.deleteOne()

  await createAuditLog(req, 'DELETE_CAREER_APPLICATION', 'CareerApplication', req.params.id, {
    roleType: item.roleType,
    hadCv: Boolean(item.cvPublicId),
    hadOnboardingDocs: Boolean(item.onboardingDocsPublicId),
    hadOfferLetter: Boolean(item.offerLetter?.publicId),
    hadCertificate: Boolean(item.certificate?.publicId),
  })

  res.json({ message: 'Application deleted' })
})
