import dotenv from 'dotenv'

dotenv.config()

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

const required = ['MONGODB_URI', 'JWT_SECRET']

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
})

const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://indocreonix.vercel.app',
  'https://indocreonix.com',
  'https://www.indocreonix.com',
  'https://*.vercel.app',
  'https://*.netlify.app',
]

const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, '')

const configuredCorsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean)

const corsOrigins = Array.from(
  new Set([...defaultCorsOrigins, ...configuredCorsOrigins].map((origin) => normalizeOrigin(origin)))
)

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',

  // ── Email / SMTP ──────────────────────────────────────────────────────────
  smtpHost:        process.env.SMTP_HOST        || 'smtp.hostinger.com',
  smtpPort:        Number(process.env.SMTP_PORT   || 587),
  smtpSecure:      parseBool(process.env.SMTP_SECURE, Number(process.env.SMTP_PORT || 587) === 465),
  smtpUser:        process.env.SMTP_USER         || '',   // master mailbox login
  smtpPass:        process.env.SMTP_PASS         || '',   // master mailbox password
  smtpRequireTls:  parseBool(process.env.SMTP_REQUIRE_TLS, false),
  smtpIgnoreTls:   parseBool(process.env.SMTP_IGNORE_TLS, false),
  smtpRejectUnauthorized: parseBool(process.env.SMTP_REJECT_UNAUTHORIZED, false),
  smtpConnectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 20000),
  smtpGreetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
  smtpSocketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 30000),
  smtpInfoFrom:    process.env.SMTP_INFO_FROM    || 'info@indocreonix.com',
  smtpContactFrom: process.env.SMTP_CONTACT_FROM || 'contact@indocreonix.com',
  smtpCareersFrom: process.env.SMTP_CAREERS_FROM || 'careers@indocreonix.com',
}
