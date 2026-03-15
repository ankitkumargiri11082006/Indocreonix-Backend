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
  'https://indocreonix.vercel.app',
  'https://*.vercel.app',
  'https://*.netlify.app',
]

const configuredCorsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const corsOrigins = Array.from(new Set([...defaultCorsOrigins, ...configuredCorsOrigins]))

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
}
