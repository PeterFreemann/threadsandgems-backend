import { Router } from 'express';
import { z } from 'zod';
import { clerkClient } from '@clerk/express';
import { requirePermission } from '../../middleware/auth.js';
import { parse } from '../../middleware/validate.js';
import { HttpError } from '../../middleware/errors.js';
import { audit } from '../../lib/audit.js';
import { ADMIN_ROLES, ROLE_LABELS } from '../../lib/roles.js';
import { describeUser, forgetUser } from '../../lib/clerkUsers.js';

const router = Router();

// Clerk can't filter by metadata, so walk through users. Fine for a store-sized user base.
async function allUsers() {
  const users = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const page = await clerkClient.users.getUserList({ limit: 100, offset });
    const batch = page.data ?? page;
    users.push(...batch);
    if (batch.length < 100) break;
  }
  return users;
}

router.get('/', requirePermission('team:manage'), async (req, res) => {
  const users = await allUsers();
  const items = users
    .filter((u) => ADMIN_ROLES.includes(u.publicMetadata?.role))
    .map(describeUser)
    .sort((a, b) => ADMIN_ROLES.indexOf(a.role) - ADMIN_ROLES.indexOf(b.role));
  res.json({ items });
});

router.post('/', requirePermission('team:manage'), async (req, res) => {
  const { email, role } = parse(
    z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address.'), role: z.enum(ADMIN_ROLES) }),
    req.body
  );
  const found = await clerkClient.users.getUserList({ emailAddress: [email] });
  const user = (found.data ?? found)[0];
  if (!user) throw new HttpError(404, `No account uses ${email}. Ask them to sign up on the store first, then try again.`);

  await clerkClient.users.updateUserMetadata(user.id, { publicMetadata: { role } });
  forgetUser(user.id);
  await audit(req, { action: 'team.add', entity: 'user', entityId: user.id, summary: `Gave ${email} the ${ROLE_LABELS[role]} role` });
  res.status(201).json({ ok: true });
});

router.patch('/:userId', requirePermission('team:manage'), async (req, res) => {
  const { role } = parse(z.object({ role: z.enum(ADMIN_ROLES).nullable() }), req.body);
  if (req.params.userId === req.admin.userId) throw new HttpError(400, "You can't change your own role.");

  const user = await clerkClient.users.getUser(req.params.userId).catch(() => null);
  if (!user) throw new HttpError(404, 'That team member no longer exists.');

  // Setting a metadata key to null removes it.
  await clerkClient.users.updateUserMetadata(user.id, { publicMetadata: { role } });
  const { email } = describeUser(user);
  await audit(req, {
    action: role ? 'team.role' : 'team.remove',
    entity: 'user',
    entityId: user.id,
    summary: role ? `Changed ${email} to ${ROLE_LABELS[role]}` : `Removed admin access for ${email}`,
  });
  res.json({ ok: true });
});

export default router;
