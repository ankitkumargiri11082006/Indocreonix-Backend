import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectDatabase() {
  await mongoose.connect(env.mongoUri)
  // eslint-disable-next-line no-console
  console.log('✅ MongoDB connected')
}
