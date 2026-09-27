import mongoose from 'mongoose';
import { HttpError } from '../middleware/errors.js';

export function getPaging(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function paged(items, total, { page, limit }) {
  return { items, page, pages: Math.max(1, Math.ceil(total / limit)), total };
}

export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function searchRegex(q) {
  const text = String(q || '').trim();
  return text ? new RegExp(escapeRegex(text), 'i') : null;
}

export function assertObjectId(id, what = 'Item') {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, `${what} not found.`);
  return id;
}

export function formatPounds(pence) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format((pence || 0) / 100);
}
