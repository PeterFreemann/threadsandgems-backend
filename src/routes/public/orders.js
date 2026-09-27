import { Router } from 'express';
import Order from '../../models/Order.js';
import { requireUser } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/errors.js';
import { customerOrder } from '../../lib/serializers.js';

const router = Router();

// Signed-in shopper's order history (replaces the Stripe search in account/orders).
router.get('/me', requireUser, async (req, res) => {
  const orders = await Order.find({ clerkUserId: req.userId, paymentStatus: { $nin: ['pending', 'failed'] } })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ items: orders.map(customerOrder) });
});

// Used by /order-confirmed?payment_intent=pi_... right after payment.
// paymentStatus may still be "pending" for a few seconds until Stripe's webhook arrives; poll until it's "paid".
router.get('/confirmation/:paymentIntentId', async (req, res) => {
  const id = String(req.params.paymentIntentId);
  if (!id.startsWith('pi_')) throw new HttpError(404, 'Order not found.');
  const order = await Order.findOne({ stripePaymentIntentId: id }).lean();
  if (!order) throw new HttpError(404, 'Order not found.');
  res.json(customerOrder(order));
});

export default router;
