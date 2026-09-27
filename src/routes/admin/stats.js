import { Router } from 'express';
import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import { requirePermission } from '../../middleware/auth.js';
import { PAID_STATUSES } from '../../lib/labels.js';

const router = Router();
const LOW_STOCK = 3;

router.get('/', requirePermission('dashboard:view'), async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const paidRecent = { paymentStatus: { $in: PAID_STATUSES }, createdAt: { $gte: since } };
  const lowStockFilter = { status: 'active', stock: { $lte: LOW_STOCK } };

  const [revenue, orders30d, toFulfilCount, lowStockCount, lowStock, recentOrders, topProducts] = await Promise.all([
    Order.aggregate([
      { $match: paidRecent },
      { $group: { _id: null, total: { $sum: { $subtract: ['$totalPence', { $ifNull: ['$refundedPence', 0] }] } } } },
    ]),
    Order.countDocuments(paidRecent),
    Order.countDocuments({ paymentStatus: 'paid', fulfilmentStatus: 'unfulfilled' }),
    Product.countDocuments(lowStockFilter),
    Product.find(lowStockFilter).sort({ stock: 1 }).limit(8).select('name stock').lean(),
    Order.find({ paymentStatus: { $in: PAID_STATUSES } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderNumber customerName email totalPence currency fulfilmentStatus paymentStatus createdAt')
      .lean(),
    Order.aggregate([
      { $match: paidRecent },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $last: '$items.name' },
          quantity: { $sum: '$items.quantity' },
          revenuePence: { $sum: { $multiply: ['$items.unitPricePence', '$items.quantity'] } },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, productId: '$_id', name: 1, quantity: 1, revenuePence: 1 } },
    ]),
  ]);

  res.json({
    revenue30dPence: revenue[0]?.total || 0,
    orders30d,
    toFulfilCount,
    lowStockCount,
    lowStock,
    recentOrders,
    topProducts,
  });
});

export default router;
