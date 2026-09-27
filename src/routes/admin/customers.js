import { Router } from 'express';
import Order from '../../models/Order.js';
import { requirePermission } from '../../middleware/auth.js';
import { getPaging, searchRegex } from '../../lib/http.js';
import { PAID_STATUSES } from '../../lib/labels.js';

const router = Router();

// Customers are built from paid orders, grouped by email (covers signed-in shoppers and guests).
router.get('/', requirePermission('customers:view'), async (req, res) => {
  const paging = getPaging(req.query);
  const match = { paymentStatus: { $in: PAID_STATUSES } };
  const q = searchRegex(req.query.q);
  if (q) match.$or = [{ email: q }, { customerName: q }];

  const [result] = await Order.aggregate([
    { $match: match },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: '$email',
        name: { $last: '$customerName' },
        clerkUserId: { $last: '$clerkUserId' },
        ordersCount: { $sum: 1 },
        totalSpentPence: { $sum: { $subtract: ['$totalPence', { $ifNull: ['$refundedPence', 0] }] } },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
    { $sort: { lastOrderAt: -1 } },
    {
      $facet: {
        items: [
          { $skip: paging.skip },
          { $limit: paging.limit },
          { $project: { _id: 0, email: '$_id', name: 1, clerkUserId: 1, ordersCount: 1, totalSpentPence: 1, lastOrderAt: 1 } },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const total = result.total[0]?.count || 0;
  res.json({ items: result.items, page: paging.page, pages: Math.max(1, Math.ceil(total / paging.limit)), total });
});

export default router;
