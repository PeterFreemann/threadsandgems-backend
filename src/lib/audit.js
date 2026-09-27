import AuditLog from '../models/AuditLog.js';

// Record an admin change. Never let logging break the request.
export async function audit(req, { action, entity, entityId, summary, changes }) {
  try {
    await AuditLog.create({
      adminUserId: req.admin?.userId,
      adminEmail: req.admin?.email,
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      summary,
      changes,
    });
  } catch (err) {
    console.error('Activity log write failed:', err.message);
  }
}
