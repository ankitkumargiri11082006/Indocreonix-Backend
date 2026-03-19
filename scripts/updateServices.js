import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Service } from '../src/models/Service.js';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const servicesData = [
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
  }
];

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB. Updating services...');
    for (const data of servicesData) {
      await Service.findOneAndUpdate({ title: data.title }, data, { upsert: true, new: true });
    }
    console.log('Services perfectly synced and updated in MongoDB!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });
