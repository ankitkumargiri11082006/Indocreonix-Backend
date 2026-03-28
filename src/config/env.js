import dotenv from 'dotenv'

dotenv.config()

const required = ['MONGODB_URI', 'JWT_SECRET']

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
})

const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://indocreonix.com',
  'https://www.indocreonix.com',
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
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  frontendRedirectUri: process.env.FRONTEND_REDIRECT_URI || '',
  corsOrigins,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',

  // ── Email (Resend) ────────────────────────────────────────────────────────
  emailProvider: String(process.env.EMAIL_PROVIDER || 'resend').trim().toLowerCase(),
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || 'onboarding@resend.dev',
  resendInfoFrom: process.env.RESEND_INFO_FROM || process.env.RESEND_FROM || 'onboarding@resend.dev',
  resendContactFrom: process.env.RESEND_CONTACT_FROM || process.env.RESEND_FROM || 'onboarding@resend.dev',
  resendCareersFrom: process.env.RESEND_CAREERS_FROM || process.env.RESEND_FROM || 'onboarding@resend.dev',
}
