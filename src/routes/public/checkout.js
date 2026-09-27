import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { getAuth } from '@clerk/express';
import Product from '../../models/Product.js';
import Order from '../../models/Order.js';
import { nextOrderNumber } from '../../models/Counter.js';
import { getSettings } from '../../models/Setting.js';
import { parse } from '../../middleware/validate.js';
import { HttpError } from '../../middleware/errors.js';
import { calculateTotals } from '../../lib/pricing.js';
import { requireStripe } from '../../config/stripe.js';
import { env } from '../../config/env.js';

const router = Router();

const schema = z.object({
  // Existing pending order to update instead of creating a new one (when the cart changes on the checkout page).
  orderId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.union([z.string().min(1), z.number().int().positive()]),
        quantity: z.number().int().min(1).max(20, 'You can buy at most 20 of one piece.'),
        size: z.string().max(20).optional(),
      })
    )
    .min(1, 'Your bag is empty.')
    .max(50),
  customer: z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
    firstName: z.string().trim().min(1, 'Enter your first name.').max(60),
    lastName: z.string().trim().min(1, 'Enter your last name.').max(60),
    phone: z.string().trim().max(30).optional(),
  }),
  shippingAddress: z.object({
    line1: z.string().trim().min(1, 'Enter your address.').max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(1, 'Enter your city.').max(100),
    postalCode: z.string().trim().min(1, 'Enter your postcode.').max(20),
    country: z.string().trim().length(2).toUpperCase(),
  }),
});

// Look up real prices and stock. The browser only sends ids and quantities; it never sends prices.
async function buildItems(requested) {
  const merged = new Map();
  for (const item of requested) {
    const key = `${item.productId}|${item.size || ''}`;
    const prev = merged.get(key);
    merged.set(key, { ...item, quantity: (prev?.quantity || 0) + item.quantity });
  }
  const lines = [...merged.values()];

  const legacyIds = lines.filter((l) => /^\d+$/.test(String(l.productId))).map((l) => Number(l.productId));
  const objectIds = lines.map((l) => String(l.productId)).filter((id) => mongoose.isValidObjectId(id) && !/^\d+$/.test(id));
  const products = await Product.find({
    status: 'active',
    $or: [{ legacyId: { $in: legacyIds } }, { _id: { $in: objectIds } }],
  }).lean();

  const find = (pid) =>
    /^\d+$/.test(String(pid))
      ? products.find((p) => p.legacyId === Number(pid))
      : products.find((p) => String(p._id) === String(pid));

  return lines.map((line) => {
    const product = find(line.productId);
    if (!product) throw new HttpError(409, 'One of the pieces in your bag is no longer available. Remove it and try again.');
    if (product.stock < line.quantity) {
      throw new HttpError(
        409,
        product.stock > 0
          ? `Only ${product.stock} of ${product.name} left. Reduce the quantity to continue.`
          : `${product.name} has sold out. Remove it from your bag to continue.`
      );
    }
    return {
      productId: product._id,
      legacyId: product.legacyId,
      name: product.name,
      image: product.images?.[0]?.url,
      size: line.size,
      unitPricePence: product.pricePence,
      quantity: line.quantity,
    };
  });
}

// POST /api/checkout -> { clientSecret, orderId, orderNumber, subtotalPence, shippingPence, vatPence, totalPence }
router.post('/', async (req, res) => {
  const stripe = requireStripe();
  const body = parse(schema, req.body);
  const { userId } = getAuth(req);
  const settings = await getSettings();

  if (!settings.shippingCountries.includes(body.shippingAddress.country)) {
    throw new HttpError(400, "We don't ship to that country yet. Contact us and we'll see what we can do.");
  }

  const items = await buildItems(body.items);
  const totals = calculateTotals(items, settings);
  const fields = {
    clerkUserId: userId || undefined,
    email: body.customer.email,
    customerName: `${body.customer.firstName} ${body.customer.lastName}`,
    phone: body.customer.phone,
    shippingAddress: body.shippingAddress,
    items,
    ...totals,
    currency: env.CURRENCY,
  };

  // Reuse this shopper's pending order if the checkout page is re-submitting.
  if (body.orderId && mongoose.isValidObjectId(body.orderId)) {
    const existing = await Order.findOne({ _id: body.orderId, paymentStatus: 'pending' });
    const sameShopper = existing && (userId ? existing.clerkUserId === userId : existing.email === body.customer.email);
    if (sameShopper && existing.stripePaymentIntentId) {
      try {
        const intent = await stripe.paymentIntents.update(existing.stripePaymentIntentId, {
          amount: totals.totalPence,
          receipt_email: body.customer.email,
        });
        existing.set(fields);
        await existing.save();
        return res.json({ clientSecret: intent.client_secret, orderId: existing._id, orderNumber: existing.orderNumber, ...totals });
      } catch {
        // The payment moved on (for example it's processing); fall through and start a fresh order.
      }
    }
  }

  const order = await Order.create({
    ...fields,
    orderNumber: await nextOrderNumber(),
    events: [{ type: 'created', message: 'Checkout started' }],
  });

  const intent = await stripe.paymentIntents.create(
    {
      amount: totals.totalPence,
      currency: env.CURRENCY,
      automatic_payment_methods: { enabled: true },
      receipt_email: body.customer.email,
      shipping: {
        name: fields.customerName,
        phone: body.customer.phone,
        address: {
          line1: body.shippingAddress.line1,
          line2: body.shippingAddress.line2,
          city: body.shippingAddress.city,
          postal_code: body.shippingAddress.postalCode,
          country: body.shippingAddress.country,
        },
      },
      metadata: { orderId: String(order._id), orderNumber: order.orderNumber, clerkUserId: userId || 'guest' },
    },
    { idempotencyKey: `order_${order._id}` }
  );

  order.stripePaymentIntentId = intent.id;
  await order.save();

  res.status(201).json({ clientSecret: intent.client_secret, orderId: order._id, orderNumber: order.orderNumber, ...totals });
});

export default router;
