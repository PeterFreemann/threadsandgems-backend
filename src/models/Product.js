import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema(
  { url: { type: String, required: true }, alt: { type: String, default: '' } },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    // Old numeric ids (1-27) from the hardcoded store, so links like /product/1 keep working.
    legacyId: { type: Number, unique: true, sparse: true },
    name: { type: String, required: [true, 'Enter a product name.'], trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortDescription: { type: String, default: '', maxlength: 300 },
    details: { type: String, default: '', maxlength: 5000 },
    pricePence: {
      type: Number,
      required: [true, 'Enter a price.'],
      min: [1, 'Price must be above £0.'],
      validate: { validator: Number.isInteger, message: 'Price must be a whole number of pence.' },
    },
    compareAtPricePence: { type: Number, default: null },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    images: { type: [imageSchema], default: [] },
    // Can briefly go below 0 if two people buy the last item at once; the order timeline flags it.
    stock: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'draft' },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.index({ status: 1, categoryId: 1, createdAt: -1 });

export default mongoose.model('Product', productSchema);
