import jwt from 'jsonwebtoken'

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs'
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'

let certCache = null
let accessTokenCache = null

function parseCacheMaxAge(cacheControl = '') {
  const match = String(cacheControl).match(/max-age=(\d+)/i)
  return match ? Number(match[1]) : 3600
}

async function getGoogleCerts() {
  const now = Date.now()
  if (certCache && certCache.expiresAt > now) {
    return certCache.certs
  }

  const response = await fetch(GOOGLE_CERTS_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch Google certs: ${response.status}`)
  }

  const certs = await response.json()
  const maxAge = parseCacheMaxAge(response.headers.get('cache-control'))
  certCache = {
    certs,
    expiresAt: now + Math.max(maxAge, 300) * 1000,
  }

  return certs
}

export async function verifyGoogleIdToken(token, audience) {
  if (!token || !audience) return null

  const decoded = jwt.decode(token, { complete: true })
  const kid = decoded?.header?.kid
  const certs = await getGoogleCerts()
  const certificate = (kid && certs[kid]) || Object.values(certs)[0]

  if (!certificate) {
    throw new Error('Google certificate unavailable')
  }

  return jwt.verify(token, certificate, {
    algorithms: ['RS256'],
    audience,
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
  })
}

function buildServiceAccountAssertion({ clientEmail, privateKey, scope, subject, tokenUrl }) {
  const now = Math.floor(Date.now() / 1000)

  return jwt.sign(
    {
      iss: clientEmail,
      scope,
      aud: tokenUrl,
      iat: now,
      exp: now + 3600,
      ...(subject ? { sub: subject } : {}),
    },
    privateKey,
    {
      algorithm: 'RS256',
      header: { typ: 'JWT' },
    }
  )
}

export async function getServiceAccountAccessToken({ clientEmail, privateKey, scope, subject = '' }) {
  const cacheKey = [clientEmail, scope, subject].join('|')
  const now = Date.now()

  if (accessTokenCache?.cacheKey === cacheKey && accessTokenCache.expiresAt > now) {
    return accessTokenCache.token
  }

  const assertion = buildServiceAccountAssertion({
    clientEmail,
    privateKey,
    scope,
    subject,
    tokenUrl: GOOGLE_OAUTH_TOKEN_URL,
  })

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  })

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Failed to obtain Google access token')
  }

  const expiresIn = Number(data.expires_in || 3600)
  accessTokenCache = {
    cacheKey,
    token: data.access_token,
    expiresAt: now + Math.max(expiresIn - 60, 60) * 1000,
  }

  return data.access_token
}