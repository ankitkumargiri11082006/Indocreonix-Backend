import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { env } from '../config/env.js'
import { PortalAccount } from '../models/PortalAccount.js'
import { CareerApplication } from '../models/CareerApplication.js'
import { ProjectOrder } from '../models/ProjectOrder.js'
import { signPortalToken } from '../middlewares/portalAuth.js'
import { sendPortalOtpEmail } from '../utils/emailService.js'

const googleClient = new OAuth2Client()
const OTP_EXPIRES_MINUTES = Number(process.env.PORTAL_OTP_EXPIRES_MINUTES || 10)

function normalizeTrackInput(track) {
  const normalized = String(track || 'both').toLowerCase()
  if (normalized === 'career') return { career: true, project: false }
  if (normalized === 'project') return { career: false, project: true }
  return { career: true, project: true }
}

function sanitizePortalUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    phone: user.phone || '',
    organization: user.organization || '',
    roleTitle: user.roleTitle || '',
    location: user.location || '',
    bio: user.bio || '',
    access: user.access,
    isEmailVerified: user.isEmailVerified,
    isActive: user.isActive,
    defaultDashboard: user.access?.project && !user.access?.career ? 'project' : 'career',
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  }
}

function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function mapCareerStatus(status) {
  const normalized = String(status || 'new').toLowerCase()
  if (normalized === 'new') return 'Pending'
  if (normalized === 'reviewing') return 'Screening'
  if (normalized === 'shortlisted') return 'Interview'
  if (normalized === 'hired') return 'Selected'
  if (normalized === 'rejected') return 'Closed'
  return 'Pending'
}

function mapProjectStatus(status) {
  const normalized = String(status || 'new').toLowerCase()
  if (['won', 'completed', 'delivered'].includes(normalized)) return 'Delivered'
  if (normalized === 'lost') return 'Closed'
  return 'Pending'
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildEmailQuery(email = '') {
  const normalized = String(email || '').toLowerCase().trim()
  if (!normalized) return null
  return { $regex: `^${escapeRegex(normalized)}$`, $options: 'i' }
}

async function ensurePortalAccountFromGoogle({ payload, requestedTrack, allowCreate = true }) {
  const email = payload?.email?.toLowerCase?.().trim?.()
  if (!email || payload?.email_verified !== true) {
    throw new ApiError(401, 'Google account email is not verified')
  }

  const trackAccess = normalizeTrackInput(requestedTrack)
  let account = await PortalAccount.findOne({ email }).select('+password +otpCodeHash +otpExpiresAt')

  if (!account && allowCreate) {
    account = await PortalAccount.create({
      name: payload?.name || email.split('@')[0],
      email,
      googleId: payload?.sub || '',
      avatarUrl: payload?.picture || '',
      isEmailVerified: true,
      access: trackAccess,
      isActive: true,
    })
  }

  if (!account) {
    throw new ApiError(403, 'No account found. Please sign up first.')
  }

  if (!account.isActive) {
    throw new ApiError(403, 'Your account is disabled by admin')
  }

  account.googleId = account.googleId || payload?.sub || ''
  account.name = account.name || payload?.name || account.name
  if (!account.avatarUrl && payload?.picture) {
    account.avatarUrl = payload.picture
  }
  account.isEmailVerified = true
  account.access = {
    career: account.access?.career || trackAccess.career,
    project: account.access?.project || trackAccess.project,
  }
  account.lastLoginAt = new Date()
  account.otpCodeHash = ''
  account.otpExpiresAt = null
  await account.save()

  return account
}

export const sendPortalOtp = asyncHandler(async (req, res) => {
  const { name, email, track } = req.body

  if (!name || !email) {
    throw new ApiError(400, 'Name and email are required')
  }

  const normalizedEmail = String(email).toLowerCase().trim()
  const normalizedTrack = normalizeTrackInput(track)
  const otp = createOtpCode()
  const otpCodeHash = await bcrypt.hash(otp, 12)
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000)

  const existingAccount = await PortalAccount.findOne({ email: normalizedEmail })
  let account = existingAccount

  if (!account) {
    account = new PortalAccount({
      name: String(name).trim(),
      email: normalizedEmail,
      access: normalizedTrack,
      isEmailVerified: false,
      isActive: true,
    })
  } else {
    if (!account.isActive) {
      throw new ApiError(403, 'Your account is disabled by admin')
    }

    account.name = String(name).trim() || account.name
    account.access = {
      career: account.access?.career || normalizedTrack.career,
      project: account.access?.project || normalizedTrack.project,
    }
  }

  account.otpCodeHash = otpCodeHash
  account.otpExpiresAt = otpExpiresAt
  await account.save()

  await sendPortalOtpEmail(normalizedEmail, {
    name: account.name,
    otp,
    expiresInMinutes: OTP_EXPIRES_MINUTES,
  })

  res.json({ message: 'OTP sent to your email address' })
})

export const verifyPortalOtpAndRegister = asyncHandler(async (req, res) => {
  const { name, email, otp, password, track } = req.body

  if (!name || !email || !otp || !password) {
    throw new ApiError(400, 'Name, email, OTP and password are required')
  }

  if (String(password).length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters')
  }

  const normalizedEmail = String(email).toLowerCase().trim()
  const account = await PortalAccount.findOne({ email: normalizedEmail }).select('+password +otpCodeHash +otpExpiresAt')

  if (!account) {
    throw new ApiError(404, 'No pending sign-up found. Please request OTP first.')
  }

  if (!account.otpCodeHash || !account.otpExpiresAt) {
    throw new ApiError(400, 'OTP is not generated or has expired. Request a new OTP.')
  }

  if (account.otpExpiresAt.getTime() < Date.now()) {
    account.otpCodeHash = ''
    account.otpExpiresAt = null
    await account.save()
    throw new ApiError(400, 'OTP has expired. Request a new OTP.')
  }

  const isOtpValid = await bcrypt.compare(String(otp), account.otpCodeHash)
  if (!isOtpValid) {
    throw new ApiError(401, 'Invalid OTP code')
  }

  const trackAccess = normalizeTrackInput(track)

  account.name = String(name).trim() || account.name
  account.password = String(password)
  account.access = {
    career: account.access?.career || trackAccess.career,
    project: account.access?.project || trackAccess.project,
  }
  account.isEmailVerified = true
  account.lastLoginAt = new Date()
  account.otpCodeHash = ''
  account.otpExpiresAt = null
  await account.save()

  const token = signPortalToken(account._id.toString())

  res.status(201).json({
    message: 'Account created successfully',
    token,
    user: sanitizePortalUser(account),
  })
})

export const loginPortal = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required')
  }

  const normalizedEmail = String(email).toLowerCase().trim()
  const account = await PortalAccount.findOne({ email: normalizedEmail }).select('+password')

  if (!account) {
    throw new ApiError(401, 'Invalid credentials')
  }

  if (!account.isActive) {
    throw new ApiError(403, 'Your account is disabled by admin')
  }

  if (!account.isEmailVerified) {
    throw new ApiError(403, 'Email is not verified. Complete OTP verification first.')
  }

  const isPasswordValid = await account.comparePassword(password)
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials')
  }

  account.lastLoginAt = new Date()
  await account.save()

  const token = signPortalToken(account._id.toString())

  res.json({
    message: 'Login successful',
    token,
    user: sanitizePortalUser(account),
  })
})

export const loginOrSignupWithGooglePortal = asyncHandler(async (req, res) => {
  const { credential, flow, track } = req.body

  if (!credential) {
    throw new ApiError(400, 'Google credential is required')
  }

  if (!env.googleClientId) {
    throw new ApiError(500, 'GOOGLE_CLIENT_ID is not configured on server')
  }

  let payload
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.googleClientId,
    })
    payload = ticket.getPayload()
  } catch {
    throw new ApiError(401, 'Invalid Google credential')
  }

  const account = await ensurePortalAccountFromGoogle({
    payload,
    requestedTrack: track,
    allowCreate: true,
  })

  const token = signPortalToken(account._id.toString())

  res.json({
    message: flow === 'signup' ? 'Google sign-up successful' : 'Google sign-in successful',
    token,
    user: sanitizePortalUser(account),
  })
})

export const getMyCareerApplications = asyncHandler(async (req, res) => {
  const user = req.portalUser
  const emailQuery = buildEmailQuery(user.email)
  const items = await CareerApplication.find(emailQuery ? { email: emailQuery } : { email: user.email })
    .sort({ createdAt: -1 })
    .select('status roleType createdAt adminNotes opportunity')
    .populate('opportunity', 'title')
    .lean()

  const normalizedItems = items.map((item) => ({
    id: String(item._id),
    role: item.opportunity?.title || (item.roleType === 'internship' ? 'Internship Role' : 'Job Role'),
    status: mapCareerStatus(item.status),
    submittedAt: item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : '',
    notes: item.adminNotes || 'Application received and under processing.',
  }))

  res.json({ items: normalizedItems })
})

export const getMyProjects = asyncHandler(async (req, res) => {
  const user = req.portalUser
  const emailQuery = buildEmailQuery(user.email)
  const items = await ProjectOrder.find(emailQuery ? { email: emailQuery } : { email: user.email })
    .sort({ createdAt: -1 })
    .select('status projectSummary projectCategory projectSubtype targetTimeline updatedAt')
    .lean()

  const normalizedItems = items.map((item) => ({
    id: String(item._id).slice(-8).toUpperCase(),
    name: item.projectSummary || `${item.projectCategory}${item.projectSubtype ? ` / ${item.projectSubtype}` : ''}`,
    status: mapProjectStatus(item.status),
    eta: item.targetTimeline || (item.updatedAt ? new Date(item.updatedAt).toISOString().slice(0, 10) : ''),
    owner: 'Indocreonix Delivery Team',
  }))

  res.json({ items: normalizedItems })
})

export const updateMyPortalProfile = asyncHandler(async (req, res) => {
  const user = req.portalUser

  if (!user || !user.isActive) {
    throw new ApiError(403, 'Your portal account is disabled')
  }

  const {
    name,
    phone,
    organization,
    roleTitle,
    location,
    bio,
    avatarUrl,
  } = req.body || {}

  if (typeof name === 'string' && name.trim()) {
    user.name = name.trim()
  }

  if (typeof phone === 'string') {
    user.phone = phone.trim().slice(0, 30)
  }

  if (typeof organization === 'string') {
    user.organization = organization.trim().slice(0, 140)
  }

  if (typeof roleTitle === 'string') {
    user.roleTitle = roleTitle.trim().slice(0, 120)
  }

  if (typeof location === 'string') {
    user.location = location.trim().slice(0, 120)
  }

  if (typeof bio === 'string') {
    user.bio = bio.trim().slice(0, 1200)
  }

  if (typeof avatarUrl === 'string') {
    user.avatarUrl = avatarUrl.trim()
  }

  await user.save()

  res.json({
    message: 'Profile updated successfully',
    user: sanitizePortalUser(user),
  })
})

export const getPortalUsersAdmin = asyncHandler(async (_req, res) => {
  const items = await PortalAccount.find()
    .sort({ createdAt: -1 })
    .select('-otpCodeHash -otpExpiresAt -password')
    .lean()

  res.json({
    items: items.map((item) => ({
      id: item._id,
      name: item.name,
      email: item.email,
      avatarUrl: item.avatarUrl,
      phone: item.phone || '',
      organization: item.organization || '',
      roleTitle: item.roleTitle || '',
      location: item.location || '',
      bio: item.bio || '',
      access: item.access,
      isEmailVerified: item.isEmailVerified,
      isActive: item.isActive,
      lastLoginAt: item.lastLoginAt,
      createdAt: item.createdAt,
    })),
  })
})

export const updatePortalUserAdmin = asyncHandler(async (req, res) => {
  const {
    isActive,
    access,
    name,
    phone,
    organization,
    roleTitle,
    location,
    bio,
    avatarUrl,
    email,
  } = req.body || {}
  const item = await PortalAccount.findById(req.params.id)

  if (!item) {
    throw new ApiError(404, 'Portal user not found')
  }

  const previousEmail = String(item.email || '').toLowerCase().trim()

  if (typeof isActive === 'boolean') {
    item.isActive = isActive
  }

  if (typeof name === 'string' && name.trim()) {
    item.name = name.trim()
  }

  if (typeof phone === 'string') {
    item.phone = phone.trim().slice(0, 30)
  }

  if (typeof organization === 'string') {
    item.organization = organization.trim().slice(0, 140)
  }

  if (typeof roleTitle === 'string') {
    item.roleTitle = roleTitle.trim().slice(0, 120)
  }

  if (typeof location === 'string') {
    item.location = location.trim().slice(0, 120)
  }

  if (typeof bio === 'string') {
    item.bio = bio.trim().slice(0, 1200)
  }

  if (typeof avatarUrl === 'string') {
    item.avatarUrl = avatarUrl.trim()
  }

  if (typeof email === 'string' && email.trim()) {
    const nextEmail = email.toLowerCase().trim()
    if (nextEmail !== previousEmail) {
      const existing = await PortalAccount.findOne({ email: nextEmail, _id: { $ne: item._id } })
      if (existing) {
        throw new ApiError(409, 'Email is already used by another portal account')
      }
      item.email = nextEmail
    }
  }

  if (access && typeof access === 'object') {
    item.access = {
      career: typeof access.career === 'boolean' ? access.career : item.access?.career,
      project: typeof access.project === 'boolean' ? access.project : item.access?.project,
    }
  }

  await item.save()

  const nextEmail = String(item.email || '').toLowerCase().trim()
  if (previousEmail && nextEmail && previousEmail !== nextEmail) {
    const previousEmailQuery = buildEmailQuery(previousEmail)
    const updateQuery = previousEmailQuery ? { email: previousEmailQuery } : { email: previousEmail }

    await Promise.all([
      CareerApplication.updateMany(updateQuery, { $set: { email: nextEmail } }),
      ProjectOrder.updateMany(updateQuery, { $set: { email: nextEmail } }),
    ])
  }

  res.json({ message: 'Portal user updated', item: sanitizePortalUser(item) })
})

export const getPortalUserDetailsAdmin = asyncHandler(async (req, res) => {
  const portalUser = await PortalAccount.findById(req.params.id)
    .select('-otpCodeHash -otpExpiresAt -password')
    .lean()

  if (!portalUser) {
    throw new ApiError(404, 'Portal user not found')
  }

  const emailQuery = buildEmailQuery(portalUser.email)
  const [careerApplications, projectRequests] = await Promise.all([
    CareerApplication.find(emailQuery ? { email: emailQuery } : { email: portalUser.email })
      .sort({ createdAt: -1 })
      .populate('opportunity', 'title')
      .lean(),
    ProjectOrder.find(emailQuery ? { email: emailQuery } : { email: portalUser.email })
      .sort({ createdAt: -1 })
      .lean(),
  ])

  res.json({
    user: {
      id: portalUser._id,
      name: portalUser.name,
      email: portalUser.email,
      avatarUrl: portalUser.avatarUrl || '',
      phone: portalUser.phone || '',
      organization: portalUser.organization || '',
      roleTitle: portalUser.roleTitle || '',
      location: portalUser.location || '',
      bio: portalUser.bio || '',
      access: portalUser.access,
      isEmailVerified: portalUser.isEmailVerified,
      isActive: portalUser.isActive,
      lastLoginAt: portalUser.lastLoginAt,
      createdAt: portalUser.createdAt,
      updatedAt: portalUser.updatedAt,
    },
    careerApplications,
    projectRequests,
  })
})

export const deletePortalUserAdmin = asyncHandler(async (req, res) => {
  const item = await PortalAccount.findById(req.params.id)
  if (!item) {
    throw new ApiError(404, 'Portal user not found')
  }

  const emailQuery = buildEmailQuery(item.email)
  const query = emailQuery ? { email: emailQuery } : { email: item.email }

  const [careerResult, projectResult] = await Promise.all([
    CareerApplication.deleteMany(query),
    ProjectOrder.deleteMany(query),
  ])

  await PortalAccount.deleteOne({ _id: item._id })

  res.json({
    message: 'Portal user and related portal data deleted successfully',
    deleted: {
      portalUserId: String(item._id),
      careerApplications: careerResult.deletedCount || 0,
      projectRequests: projectResult.deletedCount || 0,
    },
  })
})

export const getPortalCareerApplicationsAdmin = asyncHandler(async (req, res) => {
  const { email, status } = req.query
  const query = {}
  if (email) {
    const emailQuery = buildEmailQuery(email)
    if (emailQuery) query.email = emailQuery
  }
  if (status) query.status = String(status)

  const items = await CareerApplication.find(query)
    .sort({ createdAt: -1 })
    .select('fullName email roleType status adminNotes createdAt opportunity')
    .populate('opportunity', 'title')
    .lean()

  res.json({ items })
})

export const updatePortalCareerApplicationAdmin = asyncHandler(async (req, res) => {
  const {
    status,
    adminNotes,
    fullName,
    email,
    phone,
    city,
    qualification,
    skills,
    experience,
    portfolio,
    message,
    roleType,
  } = req.body || {}
  const item = await CareerApplication.findById(req.params.id)
  if (!item) {
    throw new ApiError(404, 'Career application not found')
  }

  if (status) item.status = status
  if (typeof adminNotes === 'string') item.adminNotes = adminNotes
  if (typeof fullName === 'string' && fullName.trim()) item.fullName = fullName.trim()
  if (typeof email === 'string' && email.trim()) item.email = email.toLowerCase().trim()
  if (typeof phone === 'string' && phone.trim()) item.phone = phone.trim()
  if (typeof city === 'string' && city.trim()) item.city = city.trim()
  if (typeof qualification === 'string' && qualification.trim()) item.qualification = qualification.trim()
  if (typeof skills === 'string' && skills.trim()) item.skills = skills.trim()
  if (typeof experience === 'string' && experience.trim()) item.experience = experience.trim()
  if (typeof portfolio === 'string') item.portfolio = portfolio.trim()
  if (typeof message === 'string' && message.trim()) item.message = message.trim()
  if (roleType === 'internship' || roleType === 'job') item.roleType = roleType
  await item.save()

  res.json({ message: 'Career application updated', item })
})

export const getPortalProjectsAdmin = asyncHandler(async (req, res) => {
  const { email, status } = req.query
  const query = {}
  if (email) {
    const emailQuery = buildEmailQuery(email)
    if (emailQuery) query.email = emailQuery
  }
  if (status) query.status = String(status)

  const items = await ProjectOrder.find(query)
    .sort({ createdAt: -1 })
    .select('fullName email projectCategory projectSubtype projectSummary status targetTimeline adminNotes createdAt')
    .lean()

  res.json({ items })
})

export const updatePortalProjectAdmin = asyncHandler(async (req, res) => {
  const {
    status,
    adminNotes,
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
  } = req.body || {}
  const item = await ProjectOrder.findById(req.params.id)
  if (!item) {
    throw new ApiError(404, 'Project record not found')
  }

  if (status) item.status = status
  if (typeof adminNotes === 'string') item.adminNotes = adminNotes
  if (typeof fullName === 'string' && fullName.trim()) item.fullName = fullName.trim()
  if (typeof email === 'string' && email.trim()) item.email = email.toLowerCase().trim()
  if (typeof phone === 'string' && phone.trim()) item.phone = phone.trim()
  if (typeof company === 'string') item.company = company.trim()
  if (typeof targetBudget === 'string') item.targetBudget = targetBudget.trim()
  if (typeof targetTimeline === 'string') item.targetTimeline = targetTimeline.trim()
  if (typeof projectSubtype === 'string') item.projectSubtype = projectSubtype.trim()
  if (typeof requestedService === 'string') item.requestedService = requestedService.trim()
  if (typeof requestedProduct === 'string') item.requestedProduct = requestedProduct.trim()
  if (typeof projectReference === 'string') item.projectReference = projectReference.trim()
  if (typeof businessGoals === 'string' && businessGoals.trim()) item.businessGoals = businessGoals.trim()
  if (typeof projectSummary === 'string' && projectSummary.trim()) item.projectSummary = projectSummary.trim()
  if (typeof featureRequirements === 'string') item.featureRequirements = featureRequirements.trim()

  if (
    typeof projectCategory === 'string' &&
    ['website', 'web-app', 'android-app', 'ios-app', 'software', 'other'].includes(projectCategory)
  ) {
    item.projectCategory = projectCategory
  }

  await item.save()

  res.json({ message: 'Project record updated', item })
})
