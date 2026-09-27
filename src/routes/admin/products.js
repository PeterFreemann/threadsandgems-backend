import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Product from '../../models/Product.js';
import { requirePermission } from '../../middleware/auth.js';
import { parse } from '../../middleware/validate.js';
import { HttpError } from '../../middleware/errors.js';
import { audit } from '../../lib/audit.js';
import { assertObjectId, getPaging, paged, searchRegex } from '../../lib/http.js';
import { PRODUCT_STATUSES } from '../../lib/labels.js';
import { adminProduct } from '../../lib/serializers.js';

const router = Router();

const slug = z.string().trim().min(1, 'Enter a web address.').regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes only.');
const objectIdOrNull = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), 'Choose a valid category.')
  .nullable();

const productFields = {
  name: z.string().trim().min(1, 'Enter a product name.').max(150),
  slug,
  shortDescription: z.string().trim().max(300),
  details: z.string().trim().max(5000),
  pricePence: z.number().int().positive('Enter a price above £0.'),
  compareAtPricePence: z.number().int().positive().nullable(),
  categoryId: objectIdOrNull,
  stock: z.number().int().min(0, 'Stock cannot be negative.'),
  status: z.enum(PRODUCT_STATUSES),
  featured: z.boolean(),
  images: z
    .array(z.object({ url: z.string().url('Each photo needs a valid link.'), alt: z.string().max(200).default('') }))
    .max(12, 'Add at most 12 photos.'),
  legacyId: z.number().int().positive().nullable(),
};

const createSchema = z
  .object(productFields)
  .partial()
  .required({ name: true, slug: true, pricePence: true });
const updateSchema = z.object(productFields).partial();

function checkPrices(data, existing) {
  const price = data.pricePence ?? existing?.pricePence;
  const compare = data.compareAtPricePence !== undefined ? data.compareAtPricePence : existing?.compareAtPricePence;
  if (compare !== null && compare !== undefined && compare <= price) {
    throw new HttpError(400, 'The original price must be higher than the sale price.');
  }
}

router.get('/', requirePermission('products:view'), async (req, res) => {
  const paging = getPaging(req.query);
  const filter = {};
  if (PRODUCT_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (mongoose.isValidObjectId(req.query.category)) filter.categoryId = req.query.category;
  const q = searchRegex(req.query.q);
  if (q) filter.name = q;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .populate('categoryId', 'name slug')
      .lean(),
    Product.countDocuments(filter),
  ]);
  res.json(paged(items.map(adminProduct), total, paging));
});

router.get('/:id', requirePermission('products:view'), async (req, res) => {
  assertObjectId(req.params.id, 'Product');
  const product = await Product.findById(req.params.id).populate('categoryId', 'name slug').lean();
  if (!product) throw new HttpError(404, 'Product not found.');
  res.json(adminProduct(product));
});

router.post('/', requirePermission('products:edit'), async (req, res) => {
  const data = parse(createSchema, req.body);
  checkPrices(data);
  const product = await Product.create(data);
  await audit(req, { action: 'product.create', entity: 'product', entityId: product._id, summary: `Created product ${product.name}` });
  res.status(201).json(adminProduct(product.toObject()));
});

router.patch('/:id', requirePermission('products:edit'), async (req, res) => {
  assertObjectId(req.params.id, 'Product');
  const data = parse(updateSchema, req.body);
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found.');
  checkPrices(data, product);

  const changed = Object.keys(data).filter((k) => JSON.stringify(product[k]) !== JSON.stringify(data[k]));
  product.set(data);
  await product.save();
  await product.populate('categoryId', 'name slug');

  if (changed.length) {
    await audit(req, {
      action: 'product.update',
      entity: 'product',
      entityId: product._id,
      summary: `Updated product ${product.name} (${changed.join(', ')})`,
    });
  }
  res.json(adminProduct(product.toObject()));
});

router.delete('/:id', requirePermission('products:edit'), async (req, res) => {
  assertObjectId(req.params.id, 'Product');
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found.');
  await audit(req, { action: 'product.delete', entity: 'product', entityId: product._id, summary: `Deleted product ${product.name}` });
  res.json({ ok: true });
});

export default router;
