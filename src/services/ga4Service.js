import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { env } from '../config/env.js'
import { getCached, setCached } from '../utils/publicCache.js'

const hasGa4Config = Boolean(
  env.ga4PropertyId && env.ga4ClientEmail && env.ga4PrivateKey
)

let client = null

function getClient() {
  if (!hasGa4Config) return null
  if (client) return client

  const privateKey = env.ga4PrivateKey.replace(/\\n/g, '\n')
  client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: env.ga4ClientEmail,
      private_key: privateKey,
    },
    projectId: env.ga4ProjectId || undefined,
  })

  return client
}

function normalizeRows(rows = [], dimensionLabel, metricLabel) {
  return rows.map((row) => ({
    label: row.dimensionValues?.[0]?.value || dimensionLabel,
    value: Number(row.metricValues?.[0]?.value || 0),
    dimensionLabel,
    metricLabel,
  }))
}

export async function fetchGa4Overview({ days = 7 } = {}) {
  if (!hasGa4Config) return null

  const cacheKey = `days:${days}`
  const cached = getCached('ga4:overview', cacheKey)
  if (cached) return cached

  const analyticsClient = getClient()
  if (!analyticsClient) return null

  const property = `properties/${env.ga4PropertyId}`
  const dateRange = [{ startDate: `${days}daysAgo`, endDate: 'today' }]

  const [trafficSources, topPages, topCountries, deviceCategories] = await Promise.all([
    analyticsClient.runReport({
      property,
      dateRanges: dateRange,
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      limit: 6,
    }),
    analyticsClient.runReport({
      property,
      dateRanges: dateRange,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      limit: 6,
    }),
    analyticsClient.runReport({
      property,
      dateRanges: dateRange,
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 6,
    }),
    analyticsClient.runReport({
      property,
      dateRanges: dateRange,
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'sessions' }],
      limit: 5,
    }),
  ])

  const [realtimeReport, realtimeByPage, realtimeByCountry] = await Promise.all([
    analyticsClient.runRealtimeReport({
      property,
      metrics: [{ name: 'activeUsers' }],
    }),
    analyticsClient.runRealtimeReport({
      property,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 8,
    }),
    analyticsClient.runRealtimeReport({
      property,
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 8,
    }),
  ])

  const response = {
    enabled: true,
    dateRangeDays: days,
    realtimeUsers: Number(
      realtimeReport?.rows?.[0]?.metricValues?.[0]?.value || 0
    ),
    trafficSources: normalizeRows(
      trafficSources?.[0]?.rows,
      'source',
      'sessions'
    ),
    topPages: normalizeRows(
      topPages?.[0]?.rows,
      'page',
      'views'
    ),
    topCountries: normalizeRows(
      topCountries?.[0]?.rows,
      'country',
      'active users'
    ),
    deviceCategories: normalizeRows(
      deviceCategories?.[0]?.rows,
      'device',
      'sessions'
    ),
    realtimeByPage: normalizeRows(
      realtimeByPage?.[0]?.rows,
      'page',
      'active users'
    ),
    realtimeByCountry: normalizeRows(
      realtimeByCountry?.[0]?.rows,
      'country',
      'active users'
    ),
  }

  setCached('ga4:overview', response, { key: cacheKey, ttlMs: 60_000 })

  return response
}
