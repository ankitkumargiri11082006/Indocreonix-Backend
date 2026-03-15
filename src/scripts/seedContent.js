import mongoose from 'mongoose'
import { connectDatabase } from '../config/db.js'
import { SiteSetting } from '../models/SiteSetting.js'
import { Service } from '../models/Service.js'
import { Client } from '../models/Client.js'
import { Project } from '../models/Project.js'
import { Opportunity } from '../models/Opportunity.js'

const services = [
  {
    title: 'Web Applications',
    description: 'Enterprise-grade React applications, robust dashboards, and secure internal tools built for modern web standards.',
    image: '/svc_web.png',
    order: 1,
  },
  {
    title: 'Mobile Development',
    description: 'High-performance Android and iOS applications designed with perfect UI scaling and offline capabilities.',
    image: '/svc_mobile.png',
    order: 2,
  },
  {
    title: 'Custom Software',
    description: 'End-to-end bespoke software systems fully tailored around your operational workflow and growth goals.',
    image: '/svc_software.png',
    order: 3,
  },
  {
    title: 'Cloud & DevOps',
    description: 'Cloud migration, advanced CI/CD implementation, and containerized monitoring setups for stable releases.',
    image: '/svc_cloud.png',
    order: 4,
  },
]

const clients = [
  {
    name: 'Dhanbad District Kabaddi Association (DDKA)',
    logo: 'https://res.cloudinary.com/dmmll82la/image/upload/v1766683651/ddka-logo_ywnhyh.png',
    website: 'https://dhanbadkabaddiassociation.tech/',
    description: 'Sports association digital presence and management system.',
    order: 1,
  },
  {
    name: 'Indocreonix Internal Labs',
    logo: '/logo.png',
    website: 'https://indocreonix.com',
    description: 'Internal R&D and product acceleration projects.',
    order: 2,
  },
]

const projects = [
  {
    title: 'DDKA Official Platform',
    summary: 'Official website and district player data management software for DDKA.',
    details: 'Indocreonix delivered both the official public website and a practical back-office system to manage kabaddi player data and operations.',
    logo: 'https://res.cloudinary.com/dmmll82la/image/upload/v1766683651/ddka-logo_ywnhyh.png',
    website: 'https://dhanbadkabaddiassociation.tech/',
    category: 'Sports Organization Technology Delivery',
    tags: ['web', 'software', 'admin'],
    featured: true,
    order: 1,
  },
  {
    title: 'Operations Workflow Suite',
    summary: 'Custom dashboard suite to automate approvals, reports, and team workflows.',
    details: 'Built secure role-based workflows with analytics and operational reporting for internal teams.',
    logo: '/logo.png',
    website: '',
    category: 'Business Automation',
    tags: ['automation', 'dashboard'],
    featured: false,
    order: 2,
  },
]

const opportunities = [
  {
    type: 'internship',
    title: 'Frontend Development Internship',
    summary: 'Work on production React UI with mentorship and real project exposure.',
    location: 'Delhi / Remote',
    mode: 'Hybrid',
    experience: '3 to 6 months',
    order: 1,
  },
  {
    type: 'job',
    title: 'Full Stack Developer',
    summary: 'Build and scale web products across frontend, backend, and cloud infrastructure.',
    location: 'Delhi / Remote',
    mode: 'Hybrid',
    experience: '1+ years',
    order: 1,
  },
]

async function seedCollection(model, docs, label) {
  const count = await model.countDocuments()
  if (count > 0) {
    console.log(`↩ Skipped ${label}: already has ${count} record(s)`) 
    return
  }

  await model.insertMany(docs)
  console.log(`✅ Seeded ${label}: ${docs.length} record(s)`) 
}

async function seedSiteSettings() {
  const count = await SiteSetting.countDocuments()
  if (count > 0) {
    console.log(`↩ Skipped site settings: already has ${count} record(s)`) 
    return
  }

  await SiteSetting.create({
    siteName: 'Indocreonix',
    tagline: 'Build. Scale. Lead.',
    logoUrl: '/logo.png',
    supportEmail: 'contact@indocreonix.com',
    supportPhone: '+91 9876543210',
    socialLinks: {
      linkedin: 'https://www.linkedin.com/',
      instagram: 'https://www.instagram.com/',
      github: 'https://github.com/',
      x: 'https://x.com/',
    },
  })

  console.log('✅ Seeded site settings')
}

async function run() {
  try {
    await connectDatabase()

    await seedSiteSettings()
    await seedCollection(Service, services, 'services')
    await seedCollection(Client, clients, 'clients')
    await seedCollection(Project, projects, 'projects')
    await seedCollection(Opportunity, opportunities, 'opportunities')

    console.log('🎉 Content seed completed')
  } catch (error) {
    console.error('❌ Seed failed', error)
    process.exitCode = 1
  } finally {
    await mongoose.connection.close()
  }
}

run()
