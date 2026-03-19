import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Service } from '../src/models/Service.js';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const extraServices = [
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
    console.log('Connected to MongoDB. Pushing extra services...');
    for (const data of extraServices) {
      await Service.findOneAndUpdate({ title: data.title }, data, { upsert: true, new: true });
    }
    console.log('Extra services successfully populated into MongoDB!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });
