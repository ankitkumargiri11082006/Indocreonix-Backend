import { env } from '../config/env.js'
import { getCached, setCached } from '../utils/publicCache.js'
import { getServiceAccountAccessToken } from '../utils/googleAuth.js'

const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
const GA4_API_BASE = 'https://analyticsdata.googleapis.com/v1beta'

const hasGa4Config = Boolean(
  env.ga4PropertyId && env.ga4ClientEmail && env.ga4PrivateKey
)

async function getAccessToken() {
  if (!hasGa4Config) return ''

  return getServiceAccountAccessToken({
    clientEmail: env.ga4ClientEmail,
    privateKey: env.ga4PrivateKey.replace(/\n/g, '\n'),
    scope: GA4_SCOPE,
  })
}

async function ga4Fetch(pathname, body) {
  const token = await getAccessToken()
  if (!token) return null

  const response = await fetch(`${GA4_API_BASE}${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`GA4 API request failed (${response.status}): ${errorText || response.statusText}`)
  }

  return response.json()
}

function normalizeRows(rows = [], dimensionLabel, metricLabel) {
  return rows.map((row) => ({
    label: row.dimensionValues?.[0]?.value || dimensionLabel,
    value: Number(row.metricValues?.[0]?.value || 0),
    dimensionLabel,
    metricLabel,
  }))
}

async function runReport(property, body) {
  return ga4Fetch(`/properties/${property}:runReport`, body)
}

async function runRealtimeReport(property, body) {
  return ga4Fetch(`/properties/${property}:runRealtimeReport`, body)
}

export async function fetchGa4Overview({ days = 7 } = {}) {
  if (!hasGa4Config) return null

  const cacheKey = `days:${days}`
  const cached = getCached('ga4:overview', cacheKey)
  if (cached) return cached

  const property = String(env.ga4PropertyId).replace(/^properties\//, '')
  const dateRange = [{ startDate: `${days}daysAgo`, endDate: 'today' }]

  const [trafficSources, topPages, topCountries, deviceCategories] = await Promise.all([
    runReport(property, {
      dateRanges: dateRange,
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      limit: 6,
    }),
    runReport(property, {
      dateRanges: dateRange,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      limit: 6,
    }),
    runReport(property, {
      dateRanges: dateRange,
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 6,
    }),
    runReport(property, {
      dateRanges: dateRange,
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'sessions' }],
      limit: 5,
    }),
  ])

  const [realtimeReport, realtimeByPage, realtimeByCountry] = await Promise.all([
    runRealtimeReport(property, {
      metrics: [{ name: 'activeUsers' }],
    }),
    runRealtimeReport(property, {
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 8,
    }),
    runRealtimeReport(property, {
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 8,
    }),
  ])

  const response = {
    enabled: true,
    dateRangeDays: days,
    realtimeUsers: Number(realtimeReport?.rows?.[0]?.metricValues?.[0]?.value || 0),
    trafficSources: normalizeRows(trafficSources?.rows, 'source', 'sessions'),
    topPages: normalizeRows(topPages?.rows, 'page', 'views'),
    topCountries: normalizeRows(topCountries?.rows, 'country', 'active users'),
    deviceCategories: normalizeRows(deviceCategories?.rows, 'device', 'sessions'),
    realtimeByPage: normalizeRows(realtimeByPage?.rows, 'page', 'active users'),
    realtimeByCountry: normalizeRows(realtimeByCountry?.rows, 'country', 'active users'),
  }

  setCached('ga4:overview', response, { key: cacheKey, ttlMs: 60_000 })

  return response
}