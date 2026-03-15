import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { ContactLead } from '../models/ContactLead.js'

export const createLead = asyncHandler(async (req, res) => {
  const { name, email, phone, company, message } = req.body

  if (!name || !email || !message) {
    throw new ApiError(400, 'Name, email and message are required')
  }

  const lead = await ContactLead.create({ name, email, phone, company, message })

  res.status(201).json({ message: 'Lead submitted', lead })
})

export const getLeads = asyncHandler(async (_req, res) => {
  const leads = await ContactLead.find().sort({ createdAt: -1 })
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

  await lead.save()
  res.json({ message: 'Lead updated', lead })
})
