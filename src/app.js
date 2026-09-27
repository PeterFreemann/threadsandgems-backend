import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { clerkMiddleware } from '@clerk/express';
import { env, isProduction } from './config/env.js';
import { errorHandler, HttpError, notFound } from './middleware/errors.js';
import adminRoutes from './routes/admin/index.js';
import catalogRoutes from './routes/public/catalog.js';
import checkoutRoutes from './routes/public/checkout.js';
import orderRoutes from './routes/public/orders.js';
import formRoutes from './routes/public/forms.js';
import stripeWebhook from './routes/webhooks/stripe.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Render sits behind a proxy; needed for correct IPs in rate limits.
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        callback(new HttpError(403, `${origin} is not allowed to call this API. Add it to CORS_ORIGINS.`));
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    })
  );
  app.use(morgan(isProduction ? 'combined' : 'dev'));

  app.get('/', (req, res) => res.json({ name: 'Threads & Gems API', status: 'ok' }));
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Stripe needs the raw body, so this comes before express.json().
  app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);

  app.use(express.json({ limit: '1mb' }));
  app.use(clerkMiddleware({ authorizedParties: env.CORS_ORIGINS }));

  const formLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { error: 'Too many attempts. Try again in a few minutes.' } });
  const checkoutLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, message: { error: 'Too many checkout attempts. Try again in a few minutes.' } });

  app.use('/api/admin', adminRoutes);
  app.use('/api/checkout', checkoutLimiter, checkoutRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/contact', formLimiter);
  app.use('/api/newsletter', formLimiter);
  app.use('/api', formRoutes);
  app.use('/api', catalogRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
