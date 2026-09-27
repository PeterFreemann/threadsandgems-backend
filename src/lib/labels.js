export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'];
export const FULFILMENT_STATUSES = ['unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
export const PRODUCT_STATUSES = ['active', 'draft', 'archived'];
export const MESSAGE_STATUSES = ['new', 'replied', 'archived'];

// Orders that count as real sales (money was taken).
export const PAID_STATUSES = ['paid', 'partially_refunded', 'refunded'];

export const FULFILMENT_LABELS = {
  unfulfilled: 'To pack',
  processing: 'Packing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};
