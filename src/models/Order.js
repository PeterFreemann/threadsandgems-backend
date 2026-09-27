import mongoose from 'mongoose';
import { FULFILMENT_STATUSES, PAYMENT_STATUSES } from '../lib/labels.js';

// Items are a snapshot: later price or name changes never alter a past order.
const itemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    legacyId: Number,
    name: { type: String, required: true },
    image: String,
    size: String,
    unitPricePence: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    type: String,
    message: String,
    by: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    clerkUserId: { type: String, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    customerName: { type: String, required: true, trim: true },
    phone: String,
    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      postalCode: String,
      country: String,
    },
    items: { type: [itemSchema], default: [] },
    subtotalPence: { type: Number, required: true },
    shippingPence: { type: Number, default: 0 },
    vatPence: { type: Number, default: 0 },
    totalPence: { type: Number, required: true },
    refundedPence: { type: Number, default: 0 },
    currency: { type: String, default: 'gbp' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    fulfilmentStatus: { type: String, enum: FULFILMENT_STATUSES, default: 'unfulfilled' },
    carrier: String,
    trackingNumber: String,
    adminNotes: String,
    stripePaymentIntentId: { type: String, unique: true, sparse: true },
    paidAt: Date,
    restocked: { type: Boolean, default: false },
    events: { type: [eventSchema], default: [] },
  },
  { timestamps: true }
);

orderSchema.index({ paymentStatus: 1, fulfilmentStatus: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model('Order', orderSchema);
