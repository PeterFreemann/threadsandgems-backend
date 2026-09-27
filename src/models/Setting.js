import mongoose from 'mongoose';

// One document holds all store settings.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'store', unique: true },
    vatRatePercent: { type: Number, default: 20, min: 0, max: 100 },
    pricesIncludeVat: { type: Boolean, default: true },
    freeShippingThresholdPence: { type: Number, default: null },
    flatShippingPence: { type: Number, default: 0 },
    shippingCountries: { type: [String], default: ['GB', 'IE', 'FR', 'DE'] },
    contactEmail: { type: String, default: 'hello@threadsandgems.co.uk' },
    contactPhone: { type: String, default: '' },
  },
  { timestamps: true }
);

const Setting = mongoose.model('Setting', settingSchema);

export async function getSettings() {
  return Setting.findOneAndUpdate({ key: 'store' }, { $setOnInsert: { key: 'store' } }, { new: true, upsert: true }).lean();
}

export default Setting;
