import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { cloudinary } from '../config/cloudinary.js'
import { Opportunity } from '../models/Opportunity.js'
import { CareerApplication } from '../models/CareerApplication.js'
import { AdminAuditLog } from '../models/AdminAuditLog.js'

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

function uploadPdfToCloudinary(fileBuffer, originalname) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'indocreonix/cv',
        resource_type: 'raw',
        format: 'pdf',
        public_id: `cv-${Date.now()}-${originalname?.replace(/\s+/g, '-').toLowerCase()}`,
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

  const items = await Opportunity.find(query).sort({ order: 1, createdAt: -1 })
  res.json({ items })
})

export const getAdminOpportunities = asyncHandler(async (_req, res) => {
  const items = await Opportunity.find().sort({ order: 1, createdAt: -1 })
  res.json({ items })
})

export const createOpportunity = asyncHandler(async (req, res) => {
  const item = await Opportunity.create(req.body)
  res.status(201).json({ message: 'Opportunity created', item })
})

export const updateOpportunity = asyncHandler(async (req, res) => {
  const item = await Opportunity.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
  if (!item) throw new ApiError(404, 'Opportunity not found')
  res.json({ message: 'Opportunity updated', item })
})

export const deleteOpportunity = asyncHandler(async (req, res) => {
  const item = await Opportunity.findById(req.params.id)
  if (!item) throw new ApiError(404, 'Opportunity not found')
  await item.deleteOne()
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
  } = req.body

  if (!roleType || !fullName || !email || !phone || !city || !qualification || !skills || !experience || !message) {
    throw new ApiError(400, 'Please fill all required fields')
  }

  if (!req.file) {
    throw new ApiError(400, 'CV PDF is required')
  }

  const uploaded = await uploadPdfToCloudinary(req.file.buffer, req.file.originalname)

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
    cvUrl: uploaded.secure_url,
    cvPublicId: uploaded.public_id,
    cvOriginalName: req.file.originalname,
    cvBytes: req.file.size,
  })

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

  res.json({ items })
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

  if (status) item.status = status
  if (typeof adminNotes === 'string') item.adminNotes = adminNotes

  await item.save()

  await createAuditLog(req, 'UPDATE_CAREER_APPLICATION', 'CareerApplication', item._id, {
    status: item.status,
    hasAdminNotes: Boolean(item.adminNotes),
  })

  res.json({ message: 'Application updated', item })
})
