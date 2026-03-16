import { asyncHandler } from '../utils/asyncHandler.js'
import { SiteSetting } from '../models/SiteSetting.js'
import { clearCacheByNamespace, getCached, setCached } from '../utils/publicCache.js'

const SETTINGS_PUBLIC_CACHE_NAMESPACE = 'settings:public'

export const getSettings = asyncHandler(async (_req, res) => {
  const cachedSettings = getCached(SETTINGS_PUBLIC_CACHE_NAMESPACE)
  if (cachedSettings) {
    return res.json({ settings: cachedSettings })
  }

  let settings = await SiteSetting.findOne().lean()

  if (!settings) {
    const created = await SiteSetting.create({})
    settings = created.toObject()
  }

  setCached(SETTINGS_PUBLIC_CACHE_NAMESPACE, settings, { ttlMs: 60_000 })

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

  clearCacheByNamespace(SETTINGS_PUBLIC_CACHE_NAMESPACE)

  res.json({ message: 'Settings updated', settings })
})
