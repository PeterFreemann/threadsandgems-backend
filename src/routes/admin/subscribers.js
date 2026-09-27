import { Router } from 'express';
import Subscriber from '../../models/Subscriber.js';
import { requirePermission } from '../../middleware/auth.js';
import { getPaging, paged } from '../../lib/http.js';

const router = Router();

router.get('/', requirePermission('subscribers:view'), async (req, res) => {
  const paging = getPaging(req.query, { defaultLimit: 100, maxLimit: 5000 });
  const [items, total] = await Promise.all([
    Subscriber.find().sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit).lean(),
    Subscriber.countDocuments(),
  ]);
  res.json(paged(items, total, paging));
});

export default router;
