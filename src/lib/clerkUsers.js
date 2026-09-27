import { clerkClient } from '@clerk/express';

const cache = new Map();
const TEN_MINUTES = 10 * 60 * 1000;

// Admin emails are used for the activity log and order timeline, so cache them briefly.
export async function getUserEmail(userId) {
  const hit = cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.email;
  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || userId;
    cache.set(userId, { email, expires: Date.now() + TEN_MINUTES });
    return email;
  } catch {
    return userId;
  }
}

export function forgetUser(userId) {
  cache.delete(userId);
}

export function describeUser(user) {
  return {
    userId: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(' '),
    email: user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || '',
    imageUrl: user.imageUrl,
    role: user.publicMetadata?.role || null,
  };
}
