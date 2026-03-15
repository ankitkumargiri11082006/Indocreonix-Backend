import { asyncHandler } from '../utils/asyncHandler.js'
import { SiteSetting } from '../models/SiteSetting.js'

export const getSettings = asyncHandler(async (_req, res) => {
  let settings = await SiteSetting.findOne()

  if (!settings) {
    settings = await SiteSetting.create({})
  }

  res.json({ settings })
})

export const updateSettings = asyncHandler(async (req, res) => {
  let settings = await SiteSetting.findOne()

  if (!settings) {
    settings = await SiteSetting.create(req.body)
  } else {
    Object.assign(settings, req.body)
    await settings.save()
  }

  res.json({ message: 'Settings updated', settings })
})
