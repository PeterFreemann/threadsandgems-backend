// Keep in sync with lib/roles.js in the admin app.
export const ROLES = { SUPER_ADMIN: 'super_admin', ADMIN: 'admin', STAFF: 'staff' };
export const ADMIN_ROLES = Object.values(ROLES);
export const ROLE_LABELS = { super_admin: 'Super admin', admin: 'Admin', staff: 'Staff' };

const ALL = ADMIN_ROLES;
const MANAGERS = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
const OWNER = [ROLES.SUPER_ADMIN];

const PERMISSIONS = {
  'dashboard:view': ALL,
  'orders:view': ALL,
  'orders:update': ALL,
  'orders:refund': MANAGERS,
  'products:view': ALL,
  'products:edit': MANAGERS,
  'categories:edit': MANAGERS,
  'customers:view': ALL,
  'messages:view': ALL,
  'subscribers:view': MANAGERS,
  'settings:edit': OWNER,
  'team:manage': OWNER,
  'audit:view': OWNER,
};

export function can(role, permission) {
  return Boolean(role) && (PERMISSIONS[permission] || []).includes(role);
}

export function getRoleFromClaims(sessionClaims) {
  const role = sessionClaims?.metadata?.role;
  return ADMIN_ROLES.includes(role) ? role : null;
}
