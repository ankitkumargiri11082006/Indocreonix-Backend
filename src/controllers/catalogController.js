import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { Service } from '../models/Service.js'
import { Client } from '../models/Client.js'
import { Project } from '../models/Project.js'

function parseTags(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function crudHandlers(Model) {
  return {
    listPublic: asyncHandler(async (_req, res) => {
      const items = await Model.find({ isActive: true }).sort({ order: 1, createdAt: -1 })
      res.json({ items })
    }),
    listAdmin: asyncHandler(async (_req, res) => {
      const items = await Model.find().sort({ order: 1, createdAt: -1 })
      res.json({ items })
    }),
    create: asyncHandler(async (req, res) => {
      const payload = { ...req.body }
      if ('tags' in payload) payload.tags = parseTags(payload.tags)
      const item = await Model.create(payload)
      res.status(201).json({ message: 'Created', item })
    }),
    update: asyncHandler(async (req, res) => {
      const payload = { ...req.body }
      if ('tags' in payload) payload.tags = parseTags(payload.tags)
      const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
      if (!item) throw new ApiError(404, 'Item not found')
      res.json({ message: 'Updated', item })
    }),
    remove: asyncHandler(async (req, res) => {
      const item = await Model.findById(req.params.id)
      if (!item) throw new ApiError(404, 'Item not found')
      await item.deleteOne()
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
