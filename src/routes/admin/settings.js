import { Router } from 'express';
import { z } from 'zod';
import Setting, { getSettings } from '../../models/Setting.js';
import { requirePermission } from '../../middleware/auth.js';
import { parse } from '../../middleware/validate.js';
import { audit } from '../../lib/audit.js';

const router = Router();

const schema = z
  .object({
    vatRatePercent: z.number().min(0).max(100),
    pricesIncludeVat: z.boolean(),
    freeShippingThresholdPence: z.number().int().min(0).nullable(),
    flatShippingPence: z.number().int().min(0),
    shippingCountries: z.array(z.string().length(2).toUpperCase()).min(1, 'Pick at least one country you ship to.'),
    contactEmail: z.union([z.string().email('Enter a valid email.'), z.literal('')]),
    contactPhone: z.string().max(50),
  })
  .partial();

router.get('/', requirePermission('settings:edit'), async (req, res) => {
  res.json(await getSettings());
});

router.patch('/', requirePermission('settings:edit'), async (req, res) => {
  const data = parse(schema, req.body);
  await getSettings();
  const settings = await Setting.findOneAndUpdate({ key: 'store' }, { $set: data }, { new: true }).lean();
  await audit(req, { action: 'settings.update', entity: 'settings', summary: 'Changed store settings', changes: data });
  res.json(settings);
});

export default router;
