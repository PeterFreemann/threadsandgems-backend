import { Router } from 'express';
import AuditLog from '../../models/AuditLog.js';
import { requirePermission } from '../../middleware/auth.js';
import { getPaging, paged } from '../../lib/http.js';

const router = Router();

router.get('/', requirePermission('audit:view'), async (req, res) => {
  const paging = getPaging(req.query, { defaultLimit: 50 });
  const [items, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit).lean(),
    AuditLog.countDocuments(),
  ]);
  res.json(paged(items, total, paging));
});

export default router;
