import Stripe from 'stripe';
import { env } from './env.js';
import { HttpError } from '../middleware/errors.js';

export const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

export function requireStripe() {
  if (!stripe) throw new HttpError(503, 'Payments are not set up yet. Add STRIPE_SECRET_KEY to the backend.');
  return stripe;
}
