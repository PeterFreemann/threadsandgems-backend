import { Router } from 'express';
import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import { stripe } from '../../config/stripe.js';
import { env } from '../../config/env.js';
import { formatPounds } from '../../lib/http.js';

const router = Router();

// Stripe calls this after payments. It's the only place an order becomes "paid".
// Mounted with express.raw() so the signature can be checked against the exact body.
router.post('/', async (req, res) => {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe webhook is not configured.' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature check failed: ${err.message}` });
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      await markPaid(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await markFailed(event.data.object);
      break;
    case 'charge.refunded':
      await syncRefund(event.data.object);
      break;
    default:
      break;
  }
  res.json({ received: true });
});

async function findOrderFor(intent) {
  const orderId = intent.metadata?.orderId;
  if (orderId && mongoose.isValidObjectId(orderId)) return orderId;
  const order = await Order.findOne({ stripePaymentIntentId: intent.id }).select('_id').lean();
  return order?._id;
}

async function markPaid(intent) {
  const orderId = await findOrderFor(intent);
  if (!orderId) return console.warn(`Paid intent ${intent.id} has no matching order.`);

  // Only flips pending/failed orders, so Stripe retrying the webhook can't double-count stock.
  const order = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $in: ['pending', 'failed'] } },
    {
      $set: { paymentStatus: 'paid', paidAt: new Date(), stripePaymentIntentId: intent.id },
      $push: { events: { type: 'paid', message: `Payment of ${formatPounds(intent.amount_received)} received` } },
    },
    { new: true }
  );
  if (!order) return;

  const notes = [];
  if (intent.amount_received !== order.totalPence) {
    notes.push({ type: 'warning', message: `Amount paid (${formatPounds(intent.amount_received)}) differs from order total (${formatPounds(order.totalPence)}). Check this order.` });
  }

  const withProduct = order.items.filter((i) => i.productId);
  if (withProduct.length) {
    await Product.bulkWrite(
      withProduct.map((i) => ({ updateOne: { filter: { _id: i.productId }, update: { $inc: { stock: -i.quantity } } } }))
    );
    const oversold = await Product.find({ _id: { $in: withProduct.map((i) => i.productId) }, stock: { $lt: 0 } }).select('name').lean();
    for (const p of oversold) {
      notes.push({ type: 'warning', message: `${p.name} is oversold. Stock went below zero after this order.` });
    }
  }

  if (notes.length) await Order.updateOne({ _id: order._id }, { $push: { events: { $each: notes } } });
}

async function markFailed(intent) {
  const orderId = await findOrderFor(intent);
  if (!orderId) return;
  const reason = intent.last_payment_error?.message || 'Payment failed';
  await Order.updateOne(
    { _id: orderId, paymentStatus: 'pending' },
    { $set: { paymentStatus: 'failed' }, $push: { events: { type: 'failed', message: reason } } }
  );
}

// Keeps refunds in step even if they were made in the Stripe dashboard instead of the admin.
async function syncRefund(charge) {
  const order = await Order.findOne({ stripePaymentIntentId: charge.payment_intent });
  if (!order) return;
  const refunded = charge.amount_refunded || 0;
  if (refunded <= (order.refundedPence || 0)) return;

  order.events.push({ type: 'refund', message: `Stripe confirms ${formatPounds(refunded)} refunded in total` });
  order.refundedPence = refunded;
  order.paymentStatus = refunded >= order.totalPence ? 'refunded' : 'partially_refunded';
  await order.save();
}

export default router;
