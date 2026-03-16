export const ADMIN_PERMISSION_KEYS = [
  'dashboard',
  'analytics',
  'auditLogs',
  'projects',
  'clients',
  'services',
  'content',
  'media',
  'leads',
  'orders',
  'openings',
  'applications',
  'users',
  'integrations',
  'settings',
  'profile',
]

export const DEFAULT_ADMIN_PERMISSIONS = ADMIN_PERMISSION_KEYS.reduce((accumulator, key) => {
  accumulator[key] = false
  return accumulator
}, {})

export const FULL_ADMIN_PERMISSIONS = ADMIN_PERMISSION_KEYS.reduce((accumulator, key) => {
  accumulator[key] = true
  return accumulator
}, {})

export function normalizePermissions(input = {}) {
  return ADMIN_PERMISSION_KEYS.reduce((accumulator, key) => {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      accumulator[key] = Boolean(input[key])
    }
    return accumulator
  }, {})
}
