import mongoose from 'mongoose'

const themeSchema = new mongoose.Schema(
  {
    primary: { type: String, default: '#4285f4' },
    secondary: { type: String, default: '#ea4335' },
    accent: { type: String, default: '#fbbc05' },
    success: { type: String, default: '#34a853' },
    headingFont: { type: String, default: 'Outfit' },
    bodyFont: { type: String, default: 'Inter' },
  },
  { _id: false }
)

const siteSettingSchema = new mongoose.Schema(
  {
    siteName: { type: String, default: 'Indocreonix' },
    tagline: { type: String, default: 'Build. Scale. Lead.' },
    logoUrl: { type: String, default: '/logo.png' },
    supportEmail: { type: String, default: '' },
    supportPhone: { type: String, default: '' },
    theme: { type: themeSchema, default: () => ({}) },
    socialLinks: {
      linkedin: { type: String, default: '' },
      instagram: { type: String, default: '' },
      github: { type: String, default: '' },
      x: { type: String, default: '' },
    },
  },
  { timestamps: true }
)

export const SiteSetting = mongoose.model('SiteSetting', siteSettingSchema)
