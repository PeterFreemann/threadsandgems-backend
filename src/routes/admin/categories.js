import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Category from '../../models/Category.js';
import Product from '../../models/Product.js';
import { requirePermission } from '../../middleware/auth.js';
import { parse } from '../../middleware/validate.js';
import { HttpError } from '../../middleware/errors.js';
import { audit } from '../../lib/audit.js';
import { assertObjectId } from '../../lib/http.js';

const router = Router();

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a category name.').max(60),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes only.'),
});

router.get('/', requirePermission('products:view'), async (req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ position: 1, name: 1 }).lean(),
    Product.aggregate([{ $group: { _id: '$categoryId', count: { $sum: 1 } } }]),
  ]);
  const countFor = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  res.json({ items: categories.map((c) => ({ ...c, productCount: countFor[String(c._id)] || 0 })) });
});

router.post('/', requirePermission('categories:edit'), async (req, res) => {
  const data = parse(schema, req.body);
  const last = await Category.findOne().sort({ position: -1 }).lean();
  const category = await Category.create({ ...data, position: (last?.position ?? -1) + 1 });
  await audit(req, { action: 'category.create', entity: 'category', entityId: category._id, summary: `Created category ${category.name}` });
  res.status(201).json(category.toObject());
});

// Must come before /:id so "order" isn't read as an id.
router.put('/order', requirePermission('categories:edit'), async (req, res) => {
  const { ids } = parse(z.object({ ids: z.array(z.string().refine(mongoose.isValidObjectId)).min(1) }), req.body);
  await Category.bulkWrite(ids.map((id, position) => ({ updateOne: { filter: { _id: id }, update: { position } } })));
  await audit(req, { action: 'category.reorder', entity: 'category', summary: 'Reordered categories' });
  res.json({ ok: true });
});

router.patch('/:id', requirePermission('categories:edit'), async (req, res) => {
  assertObjectId(req.params.id, 'Category');
  const data = parse(schema.partial(), req.body);
  const category = await Category.findById(req.params.id);
  if (!category) throw new HttpError(404, 'Category not found.');
  const oldName = category.name;
  category.set(data);
  await category.save();
  await audit(req, {
    action: 'category.update',
    entity: 'category',
    entityId: category._id,
    summary: oldName === category.name ? `Updated category ${category.name}` : `Renamed category ${oldName} to ${category.name}`,
  });
  res.json(category.toObject());
});

router.delete('/:id', requirePermission('categories:edit'), async (req, res) => {
  assertObjectId(req.params.id, 'Category');
  const inUse = await Product.countDocuments({ categoryId: req.params.id });
  if (inUse) throw new HttpError(409, `${inUse} product${inUse === 1 ? ' uses' : 's use'} this category. Move them to another category first.`);
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new HttpError(404, 'Category not found.');
  await audit(req, { action: 'category.delete', entity: 'category', entityId: category._id, summary: `Deleted category ${category.name}` });
  res.json({ ok: true });
});

export default router;
