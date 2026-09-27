import { getAuth } from '@clerk/express';
import { HttpError } from './errors.js';
import { can, getRoleFromClaims } from '../lib/roles.js';
import { getUserEmail } from '../lib/clerkUsers.js';

// Signed-in shopper (storefront).
export function requireUser(req, res, next) {
  const { userId } = getAuth(req);
  if (!userId) return next(new HttpError(401, 'Sign in to continue.'));
  req.userId = userId;
  next();
}

// Admin with a specific permission. Sets req.admin = { userId, role, email }.
export function requirePermission(permission) {
  return async (req, res, next) => {
    const { userId, sessionClaims } = getAuth(req);
    if (!userId) return next(new HttpError(401, 'Your admin session has expired. Sign in again.'));

    const role = getRoleFromClaims(sessionClaims);
    if (!role) return next(new HttpError(403, 'This account has no admin access.'));
    if (!can(role, permission)) return next(new HttpError(403, "Your role can't do this. Ask the store owner."));

    req.admin = { userId, role, email: await getUserEmail(userId) };
    next();
  };
}
