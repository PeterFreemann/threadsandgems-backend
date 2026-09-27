import { Router } from 'express';
import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import Category from '../../models/Category.js';
import { getSettings } from '../../models/Setting.js';
import { HttpError } from '../../middleware/errors.js';
import { getPaging, paged, searchRegex } from '../../lib/http.js';
import { publicProduct } from '../../lib/serializers.js';

const router = Router();

// GET /api/products?category=ankara&featured=true&q=kaftan&page=1&limit=12
router.get('/products', async (req, res) => {
  const paging = getPaging(req.query, { defaultLimit: 12, maxLimit: 100 });
  const filter = { status: 'active' };

  if (req.query.category && req.query.category !== 'all') {
    const category = await Category.findOne({ slug: String(req.query.category) }).lean();
    if (!category) return res.json(paged([], 0, paging));
    filter.categoryId = category._id;
  }
  if (req.query.featured === 'true') filter.featured = true;
  const q = searchRegex(req.query.q);
  if (q) filter.name = q;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort({ featured: -1, createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .populate('categoryId', 'name slug')
      .lean(),
    Product.countDocuments(filter),
  ]);
  res.json(paged(items.map(publicProduct), total, paging));
});

// GET /api/products/1 (old id), /api/products/<mongo id>, or /api/products/<slug>
router.get('/products/:key', async (req, res) => {
  const { key } = req.params;
  const match = /^\d+$/.test(key)
    ? { legacyId: Number(key) }
    : mongoose.isValidObjectId(key)
      ? { _id: key }
      : { slug: key.toLowerCase() };

  const product = await Product.findOne({ ...match, status: 'active' }).populate('categoryId', 'name slug').lean();
  if (!product) throw new HttpError(404, 'This piece may have sold out or been removed from the collection.');

  const related = await Product.find({ status: 'active', categoryId: product.categoryId?._id ?? null, _id: { $ne: product._id } })
    .limit(3)
    .populate('categoryId', 'name slug')
    .lean();

  res.json({ ...publicProduct(product), related: related.map(publicProduct) });
});

router.get('/categories', async (req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ position: 1 }).lean(),
    Product.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$categoryId', count: { $sum: 1 } } }]),
  ]);
  const countFor = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  res.json({
    items: categories.map((c) => ({ _id: c._id, name: c.name, slug: c.slug, productCount: countFor[String(c._id)] || 0 })),
  });
});

// Shipping and VAT rules for showing the right totals in the cart before checkout.
router.get('/settings/public', async (req, res) => {
  const s = await getSettings();
  res.json({
    vatRatePercent: s.vatRatePercent,
    pricesIncludeVat: s.pricesIncludeVat,
    freeShippingThresholdPence: s.freeShippingThresholdPence,
    flatShippingPence: s.flatShippingPence,
    shippingCountries: s.shippingCountries,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
  });
});

export default router;
