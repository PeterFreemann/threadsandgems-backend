// Give an existing Clerk account the super admin role from the terminal.
//   npm run make-super-admin -- you@example.com
import 'dotenv/config';
import { createClerkClient } from '@clerk/express';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run make-super-admin -- you@example.com');
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const found = await clerk.users.getUserList({ emailAddress: [email] });
const user = (found.data ?? found)[0];

if (!user) {
  console.error(`No Clerk account uses ${email}. Sign up on the store first.`);
  process.exit(1);
}

await clerk.users.updateUserMetadata(user.id, { publicMetadata: { role: 'super_admin' } });
console.log(`${email} is now a super admin. Sign out of the admin and back in to use it.`);
