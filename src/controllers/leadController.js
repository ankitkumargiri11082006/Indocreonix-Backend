import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { ContactLead } from '../models/ContactLead.js'
import { sendContactConfirmation, sendContactNotification } from '../utils/emailService.js'

export const createLead = asyncHandler(async (req, res) => {
  const { name, email, phone, company, message } = req.body

  if (!name || !email || !message) {
    throw new ApiError(400, 'Name, email and message are required')
  }

  const lead = await ContactLead.create({ name, email, phone, company, message })

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
