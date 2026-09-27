import { Router } from 'express';
import { z } from 'zod';
import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import { requirePermission } from '../../middleware/auth.js';
import { parse } from '../../middleware/validate.js';
import { HttpError } from '../../middleware/errors.js';
import { audit } from '../../lib/audit.js';
import { assertObjectId, formatPounds, getPaging, paged, searchRegex } from '../../lib/http.js';
import { FULFILMENT_LABELS, FULFILMENT_STATUSES, PAYMENT_STATUSES } from '../../lib/labels.js';
import { requireStripe } from '../../config/stripe.js';

const router = Router();

router.get('/', requirePermission('orders:view'), async (req, res) => {
  const paging = getPaging(req.query);
  const filter = {};

  if (PAYMENT_STATUSES.includes(req.query.payment)) filter.paymentStatus = req.query.payment;
  // Abandoned checkouts stay hidden unless you ask for "Awaiting payment".
  else filter.paymentStatus = { $ne: 'pending' };

  if (FULFILMENT_STATUSES.includes(req.query.fulfilment)) filter.fulfilmentStatus = req.query.fulfilment;

  const q = searchRegex(req.query.q);
  if (q) filter.$or = [{ orderNumber: q }, { email: q }, { customerName: q }];

  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit).select('-events -adminNotes').lean(),
    Order.countDocuments(filter),
  ]);
  res.json(paged(items, total, paging));
});

router.get('/:id', requirePermission('orders:view'), async (req, res) => {
  assertObjectId(req.params.id, 'Order');
  const order = await Order.findById(req.params.id).lean();
  if (!order) throw new HttpError(404, 'Order not found.');
  res.json(order);
});

const updateSchema = z.object({
  fulfilmentStatus: z.enum(FULFILMENT_STATUSES).optional(),
  carrier: z.string().trim().max(60).optional(),
  trackingNumber: z.string().trim().max(100).optional(),
  adminNotes: z.string().max(2000).optional(),
});

router.patch('/:id', requirePermission('orders:update'), async (req, res) => {
  assertObjectId(req.params.id, 'Order');
  const body = parse(updateSchema, req.body);
  const order = await Order.findById(req.params.id);
  if (!order) throw new HttpError(404, 'Order not found.');

  const events = [];
  const by = req.admin.email;
  const before = order.fulfilmentStatus;

  if (body.fulfilmentStatus && body.fulfilmentStatus !== before) {
    order.fulfilmentStatus = body.fulfilmentStatus;
    events.push({ type: 'status', message: `Status changed from ${FULFILMENT_LABELS[before]} to ${FULFILMENT_LABELS[body.fulfilmentStatus]}`, by });

    // Put stock back when a paid order is cancelled or returned (only once).
    const leaving = ['cancelled', 'returned'].includes(body.fulfilmentStatus) && !['cancelled', 'returned'].includes(before);
    if (leaving && order.paymentStatus !== 'pending' && order.paymentStatus !== 'failed' && !order.restocked) {
      await Product.bulkWrite(
        order.items
          .filter((i) => i.productId)
          .map((i) => ({ updateOne: { filter: { _id: i.productId }, update: { $inc: { stock: i.quantity } } } }))
      );
      order.restocked = true;
      events.push({ type: 'stock', message: 'Items put back into stock', by });
    }
  }

  const trackingChanged =
    (body.trackingNumber !== undefined && body.trackingNumber !== (order.trackingNumber || '')) ||
    (body.carrier !== undefined && body.carrier !== (order.carrier || ''));
  if (body.carrier !== undefined) order.carrier = body.carrier;
  if (body.trackingNumber !== undefined) order.trackingNumber = body.trackingNumber;
  if (trackingChanged && order.trackingNumber) {
    events.push({ type: 'tracking', message: `Tracking set: ${[order.carrier, order.trackingNumber].filter(Boolean).join(' ')}`, by });
  }
  if (body.adminNotes !== undefined) order.adminNotes = body.adminNotes;

  order.events.push(...events);
  await order.save();

  if (events.length) {
    await audit(req, {
      action: 'order.update',
      entity: 'order',
      entityId: order._id,
      summary: `Updated order ${order.orderNumber}: ${events.map((e) => e.message.toLowerCase()).join('; ')}`,
    });
  }
  res.json(order.toObject());
});

const refundSchema = z.object({ amountPence: z.number().int().positive('Enter an amount above £0.') });

router.post('/:id/refund', requirePermission('orders:refund'), async (req, res) => {
  assertObjectId(req.params.id, 'Order');
  const { amountPence } = parse(refundSchema, req.body);
  const order = await Order.findById(req.params.id);
  if (!order) throw new HttpError(404, 'Order not found.');
  if (!['paid', 'partially_refunded'].includes(order.paymentStatus)) {
    throw new HttpError(400, 'Only paid orders can be refunded.');
  }
  if (!order.stripePaymentIntentId) throw new HttpError(400, 'This order has no Stripe payment to refund.');

  const refundable = order.totalPence - (order.refundedPence || 0);
  if (amountPence > refundable) throw new HttpError(400, `You can refund at most ${formatPounds(refundable)}.`);

  const stripe = requireStripe();
  await stripe.refunds.create({
    payment_intent: order.stripePaymentIntentId,
    amount: amountPence,
    metadata: { orderId: String(order._id), refundedBy: req.admin.email },
  });

  order.refundedPence = (order.refundedPence || 0) + amountPence;
  order.paymentStatus = order.refundedPence >= order.totalPence ? 'refunded' : 'partially_refunded';
  order.events.push({ type: 'refund', message: `Refunded ${formatPounds(amountPence)}`, by: req.admin.email });
  await order.save();

  await audit(req, {
    action: 'order.refund',
    entity: 'order',
    entityId: order._id,
    summary: `Refunded ${formatPounds(amountPence)} on order ${order.orderNumber}`,
  });
  res.json(order.toObject());
});

export default router;
