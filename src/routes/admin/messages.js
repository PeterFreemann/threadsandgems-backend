import { Router } from 'express';
import { z } from 'zod';
import ContactMessage from '../../models/ContactMessage.js';
import { requirePermission } from '../../middleware/auth.js';
import { parse } from '../../middleware/validate.js';
import { HttpError } from '../../middleware/errors.js';
import { audit } from '../../lib/audit.js';
import { assertObjectId, getPaging, paged } from '../../lib/http.js';
import { MESSAGE_STATUSES } from '../../lib/labels.js';

const router = Router();

router.get('/', requirePermission('messages:view'), async (req, res) => {
  const paging = getPaging(req.query);
  const filter = { status: MESSAGE_STATUSES.includes(req.query.status) ? req.query.status : 'new' };
  const [items, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit).lean(),
    ContactMessage.countDocuments(filter),
  ]);
  res.json(paged(items, total, paging));
});

router.patch('/:id', requirePermission('messages:view'), async (req, res) => {
  assertObjectId(req.params.id, 'Message');
  const { status } = parse(z.object({ status: z.enum(MESSAGE_STATUSES) }), req.body);
  const message = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
  if (!message) throw new HttpError(404, 'Message not found.');
  await audit(req, {
    action: 'message.update',
    entity: 'message',
    entityId: message._id,
    summary: `Marked message from ${message.email} as ${status}`,
  });
  res.json(message);
});

export default router;
