import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { Service } from '../models/Service.js'
import { Client } from '../models/Client.js'
import { Project } from '../models/Project.js'
import { MediaAsset } from '../models/MediaAsset.js'
import { cloudinary } from '../config/cloudinary.js'
import { clearCacheByNamespace, getCached, setCached } from '../utils/publicCache.js'

const catalogImageReferences = [
  { modelName: 'service', Model: Service, field: 'image' },
  { modelName: 'client', Model: Client, field: 'logo' },
  { modelName: 'project', Model: Project, field: 'logo' },
]

function parseTags(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function normalizeAssetUrl(value, fieldName) {
  if (value === undefined) return undefined
  if (value === null) return ''

  const normalizedValue = String(value).trim()
  if (!normalizedValue) return ''

  try {
    const parsedUrl = new URL(normalizedValue)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol')
    }
    return parsedUrl.toString()
  } catch {
    throw new ApiError(400, `${fieldName} must be a valid URL`)
  }
}

function extractCloudinaryPublicId(assetUrl = '') {
  if (!assetUrl || typeof assetUrl !== 'string') return ''

  const uploadSegment = '/upload/'
  const uploadIndex = assetUrl.indexOf(uploadSegment)
  if (uploadIndex === -1) return ''

  let pathAfterUpload = assetUrl.slice(uploadIndex + uploadSegment.length)
  pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '')

  const publicId = pathAfterUpload.replace(/\.[^/.]+$/, '')
  return decodeURIComponent(publicId)
}

async function deleteCloudinaryImageByUrl(assetUrl) {
  const publicId = extractCloudinaryPublicId(assetUrl)
  if (!publicId) return

  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
}

async function isImageUrlReferencedElsewhere({ currentModelName, currentItemId, imageUrl }) {
  if (!imageUrl) return false

  for (const reference of catalogImageReferences) {
    const query = {
      [reference.field]: imageUrl,
    }

    if (reference.modelName === currentModelName && currentItemId) {
      query._id = { $ne: currentItemId }
    }

    const exists = await reference.Model.exists(query)
    if (exists) {
      return true
    }
  }

  return false
}

async function safelyDeleteCloudinaryImage({ currentModelName, currentItemId, imageUrl }) {
  if (!imageUrl) return

  const isReferenced = await isImageUrlReferencedElsewhere({
    currentModelName,
    currentItemId,
    imageUrl,
  })

  if (isReferenced) return

  await MediaAsset.deleteMany({ url: imageUrl })
  await deleteCloudinaryImageByUrl(imageUrl)
}

function crudHandlers(Model) {
  const modelName = String(Model?.modelName || 'model').toLowerCase()
  const cacheNamespace = `catalog:${modelName}:public`

  return {
    listPublic: asyncHandler(async (_req, res) => {
      const cachedItems = getCached(cacheNamespace)
      if (cachedItems) {
        return res.json({ items: cachedItems })
      }

      const items = await Model.find({ isActive: true })
        .sort({ order: 1, createdAt: -1 })
        .select('-__v')
        .lean()

      setCached(cacheNamespace, items, { ttlMs: 60_000 })
      res.json({ items })
    }),
    listAdmin: asyncHandler(async (_req, res) => {
      const items = await Model.find().sort({ order: 1, createdAt: -1 }).select('-__v').lean()
      res.json({ items })
    }),
    create: asyncHandler(async (req, res) => {
      const payload = { ...req.body }
      if ('image' in payload) payload.image = normalizeAssetUrl(payload.image, 'image')
      if ('logo' in payload) payload.logo = normalizeAssetUrl(payload.logo, 'logo')
      if ('tags' in payload) payload.tags = parseTags(payload.tags)
      if (modelName === 'project') {
        payload.developerName =
          payload.developerName || payload.developer || payload.developerCredit || payload.developer_name || ''
      }
      const item = await Model.create(payload)
      clearCacheByNamespace(cacheNamespace)
      res.status(201).json({ message: 'Created', item })
    }),
    update: asyncHandler(async (req, res) => {
      const payload = { ...req.body }
      if ('image' in payload) payload.image = normalizeAssetUrl(payload.image, 'image')
      if ('logo' in payload) payload.logo = normalizeAssetUrl(payload.logo, 'logo')
      if ('tags' in payload) payload.tags = parseTags(payload.tags)
      if (modelName === 'project') {
        payload.developerName =
          payload.developerName || payload.developer || payload.developerCredit || payload.developer_name || ''
      }

      const existingItem = await Model.findById(req.params.id)
      if (!existingItem) throw new ApiError(404, 'Item not found')

      const previousImageUrl = existingItem.image || existingItem.logo || ''

      const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
      if (!item) throw new ApiError(404, 'Item not found')

      const nextImageUrl = item.image || item.logo || ''
      if (previousImageUrl && previousImageUrl !== nextImageUrl) {
        await safelyDeleteCloudinaryImage({
          currentModelName: modelName,
          currentItemId: item._id,
          imageUrl: previousImageUrl,
        })
      }

      clearCacheByNamespace(cacheNamespace)
      res.json({ message: 'Updated', item })
    }),
    remove: asyncHandler(async (req, res) => {
      const item = await Model.findById(req.params.id)
      if (!item) throw new ApiError(404, 'Item not found')

      const imageUrl = item.image || item.logo || ''
      if (imageUrl) {
        await safelyDeleteCloudinaryImage({
          currentModelName: modelName,
          currentItemId: item._id,
          imageUrl,
        })
      }

      await item.deleteOne()
      clearCacheByNamespace(cacheNamespace)
      res.json({ message: 'Deleted' })
    }),
  }
}

const services = crudHandlers(Service)
const clients = crudHandlers(Client)
const projects = crudHandlers(Project)

export const listPublicServices = services.listPublic
export const listAdminServices = services.listAdmin
export const createService = services.create
export const updateService = services.update
export const deleteService = services.remove

export const listPublicClients = clients.listPublic
export const listAdminClients = clients.listAdmin
export const createClient = clients.create
export const updateClient = clients.update
export const deleteClient = clients.remove

export const listPublicProjects = projects.listPublic
export const listAdminProjects = projects.listAdmin
export const createProject = projects.create
export const updateProject = projects.update
export const deleteProject = projects.remove
