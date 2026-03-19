import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Service } from '../src/models/Service.js';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const allServices = [
  {
    title: 'Website Development',
    description: 'Business-ready websites engineered for performance, security, and conversion.',
    image: '/images/services/web_dev.png',
    isActive: true,
    order: 1
  },
  {
    title: 'Mobile App Development',
    description: 'Cross-platform and native mobile applications for Android and iOS ecosystems.',
    image: '/images/services/app_dev.png',
    isActive: true,
    order: 2
  },
  {
    title: 'Custom Software Development',
    description: 'Tailored business software for operations, automation, and enterprise workflows.',
    image: '/images/services/software_dev.png',
    isActive: true,
    order: 3
  },
  {
    title: 'Cloud, DevOps & Data Services',
    description: 'Infrastructure and data engineering for secure, scalable digital platforms.',
    image: '/images/services/cloud_devops.png',
    isActive: true,
    order: 4
  },
  {
    title: 'AI & Data Solutions',
    description: 'Advanced machine learning, predictive analytics, and data-driven business intelligence.',
    image: '/images/services/ai_data.png',
    isActive: true,
    order: 5
  },
  {
    title: 'Business Automation',
    description: 'Streamline operations with intelligent workflow automation and API integrations.',
    image: '/images/services/business_auto.png',
    isActive: true,
    order: 6
  },
  {
    title: 'Social Media Handling',
    description: 'Comprehensive digital marketing, brand building, and engagement strategies across all platforms.',
    image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=1200&q=80',
    isActive: true,
    order: 7
  }
];

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB. Wiping old services...');
    await Service.deleteMany({});
    console.log('Inserting correct 7 services...');
    await Service.insertMany(allServices);
    console.log('All services successfully placed in MongoDB. You can now see them in Admin Panel.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });
