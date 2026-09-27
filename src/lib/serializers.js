import { formatPounds } from './http.js';

function categoryOf(product) {
  const c = product.categoryId;
  return c && typeof c === 'object' && c.name ? { _id: c._id, name: c.name, slug: c.slug } : null;
}

// Shape the admin expects: categoryId as an id plus a populated category object.
export function adminProduct(product) {
  const category = categoryOf(product);
  return { ...product, categoryId: category ? category._id : product.categoryId, category };
}

// Shape for the storefront. Also includes `id` and a "£45.00" price so the existing
// cart code (numeric ids, string prices) keeps working during the switch-over.
export function publicProduct(product) {
  const category = categoryOf(product);
  return {
    _id: product._id,
    id: product.legacyId ?? String(product._id),
    legacyId: product.legacyId ?? null,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    details: product.details,
    pricePence: product.pricePence,
    price: formatPounds(product.pricePence),
    compareAtPricePence: product.compareAtPricePence,
    image: product.images?.[0]?.url || null,
    images: product.images || [],
    category,
    featured: product.featured,
    stock: Math.max(0, product.stock),
    inStock: product.stock > 0,
  };
}

// What a shopper may see about their own order.
export function customerOrder(order) {
  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    email: order.email,
    customerName: order.customerName,
    shippingAddress: order.shippingAddress,
    items: order.items,
    subtotalPence: order.subtotalPence,
    shippingPence: order.shippingPence,
    vatPence: order.vatPence,
    totalPence: order.totalPence,
    refundedPence: order.refundedPence,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    createdAt: order.createdAt,
  };
}
