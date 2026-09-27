import { Router } from 'express';
import { z } from 'zod';
import ContactMessage from '../../models/ContactMessage.js';
import Subscriber from '../../models/Subscriber.js';
import { parse } from '../../middleware/validate.js';

const router = Router();

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  subject: z.string().trim().max(150).optional().default(''),
  message: z.string().trim().min(5, 'Write a message of at least a few words.').max(5000),
  // Hidden field in the form. People never fill it in; spam bots do.
  website: z.string().optional(),
});

router.post('/contact', async (req, res) => {
  const data = parse(contactSchema, req.body);
  if (!data.website) {
    await ContactMessage.create({ name: data.name, email: data.email, subject: data.subject, message: data.message });
  }
  res.status(201).json({ ok: true });
});

const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  source: z.enum(['home', 'shop', 'contact', 'footer']).optional().default('footer'),
});

router.post('/newsletter', async (req, res) => {
  const { email, source } = parse(newsletterSchema, req.body);
  await Subscriber.updateOne({ email }, { $setOnInsert: { email, source } }, { upsert: true });
  // Same reply whether or not they were already subscribed, so emails can't be probed.
  res.status(201).json({ ok: true });
});

export default router;
