import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { ContactLead } from '../models/ContactLead.js'
import { sendContactConfirmation, sendContactNotification } from '../utils/emailService.js'

export const createLead = asyncHandler(async (req, res) => {
  const { name, email, phone, company, message } = req.body

  if (!name || !email || !message) {
    throw new ApiError(400, 'Name, email and message are required')
  }

  const normalizedEmail = String(email).toLowerCase().trim()
  const ip = String(req.ip || '').trim()
  const userAgent = String(req.get('user-agent') || '').trim()
  const antiAbuseId = String(req.antiAbuseId || req.cookies?.ic_ab || '').trim()

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [emailCount, ipCount, cookieCount] = await Promise.all([
    ContactLead.countDocuments({ email: normalizedEmail, createdAt: { $gte: since } }),
    ip ? ContactLead.countDocuments({ ip, createdAt: { $gte: since } }) : Promise.resolve(0),
    antiAbuseId
      ? ContactLead.countDocuments({ antiAbuseId, createdAt: { $gte: since } })
      : Promise.resolve(0),
  ])

  const MAX_SUBMISSIONS_PER_DAY = 5
  if (
    emailCount >= MAX_SUBMISSIONS_PER_DAY ||
    ipCount >= MAX_SUBMISSIONS_PER_DAY ||
    cookieCount >= MAX_SUBMISSIONS_PER_DAY
  ) {
    throw new ApiError(429, 'Too many submissions. Please try again later.')
  }

  const lead = await ContactLead.create({
    name,
    email: normalizedEmail,
    phone,
    company,
    message,
    ip,
    userAgent,
    antiAbuseId,
  })

  // ── Fire-and-forget emails ───────────────────────────────────────────────
  const emailData = { name, email, phone, company, message }

  // Confirmation to the person who filled the contact form (from contact@indocreonix.com)
  sendContactConfirmation(email, emailData).catch((err) =>
    console.error('[Email] Contact confirmation failed:', err.message)
  )

  // Internal notification to contact@indocreonix.com inbox
  sendContactNotification(emailData).catch((err) =>
    console.error('[Email] Contact notification failed:', err.message)
  )

  res.status(201).json({ message: 'Lead submitted', lead })
})

export const getLeads = asyncHandler(async (_req, res) => {
  const leads = await ContactLead.find().sort({ createdAt: -1 })

  await ContactLead.updateMany(
    { isUnreadForAdmin: true },
    {
      $set: {
        isUnreadForAdmin: false,
        lastViewedByAdminAt: new Date(),
      },
    }
  )

  res.json({ leads })
})

export const updateLead = asyncHandler(async (req, res) => {
  const { id } = req.params
  const lead = await ContactLead.findById(id)

  if (!lead) {
    throw new ApiError(404, 'Lead not found')
  }

  if (req.body.status) {
    lead.status = req.body.status
  }

  if (lead.isUnreadForAdmin) {
    lead.isUnreadForAdmin = false
    lead.lastViewedByAdminAt = new Date()
  }

  await lead.save()
  res.json({ message: 'Lead updated', lead })
})

export const deleteLead = asyncHandler(async (req, res) => {
  const { id } = req.params
  const lead = await ContactLead.findById(id)

  if (!lead) {
    throw new ApiError(404, 'Lead not found')
  }

  await lead.deleteOne()
  res.json({ message: 'Lead deleted' })
})
