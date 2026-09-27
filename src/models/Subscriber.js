import mongoose from 'mongoose';

const subscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    source: { type: String, default: 'footer' },
  },
  { timestamps: true }
);

export default mongoose.model('Subscriber', subscriberSchema);
