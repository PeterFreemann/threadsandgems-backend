import 'dotenv/config';

const list = (value) =>
  (value || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

export const env = {
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI,
  CORS_ORIGINS: list(process.env.CORS_ORIGINS),
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || 'threadsandgems/products',
  CURRENCY: 'gbp',
};

export const isProduction = env.NODE_ENV === 'production';

export function checkEnv() {
  const required = ['MONGODB_URI', 'CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
  }
  if (!env.CORS_ORIGINS.length) console.warn('CORS_ORIGINS is empty, so browsers will be blocked from calling the API.');
  if (!env.STRIPE_SECRET_KEY) console.warn('STRIPE_SECRET_KEY is not set: checkout and refunds are disabled.');
  if (!env.STRIPE_WEBHOOK_SECRET) console.warn('STRIPE_WEBHOOK_SECRET is not set: paid orders will not be recorded.');
  if (!env.CLOUDINARY_API_SECRET) console.warn('Cloudinary is not set up: product photo uploads are disabled.');
}
