const cacheStore = new Map()

function buildKey(namespace, key = 'default') {
  return `${namespace}:${key}`
}

export function getCached(namespace, key = 'default') {
  const cacheKey = buildKey(namespace, key)
  const item = cacheStore.get(cacheKey)

  if (!item) return null
  if (item.expiresAt <= Date.now()) {
    cacheStore.delete(cacheKey)
    return null
  }

  return item.value
}

export function setCached(namespace, value, { key = 'default', ttlMs = 60_000 } = {}) {
  const cacheKey = buildKey(namespace, key)
  cacheStore.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs,
  })
}

export function clearCacheByNamespace(namespace) {
  for (const cacheKey of cacheStore.keys()) {
    if (cacheKey.startsWith(`${namespace}:`)) {
      cacheStore.delete(cacheKey)
    }
  }
}
