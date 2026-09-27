import { Router } from 'express';
import stats from './stats.js';
import orders from './orders.js';
import products from './products.js';
import categories from './categories.js';
import uploads from './uploads.js';
import customers from './customers.js';
import messages from './messages.js';
import subscribers from './subscribers.js';
import settings from './settings.js';
import team from './team.js';
import auditLog from './auditLog.js';

const router = Router();

router.use('/stats', stats);
router.use('/orders', orders);
router.use('/products', products);
router.use('/categories', categories);
router.use('/uploads', uploads);
router.use('/customers', customers);
router.use('/messages', messages);
router.use('/subscribers', subscribers);
router.use('/settings', settings);
router.use('/team', team);
router.use('/audit-log', auditLog);

export default router;
