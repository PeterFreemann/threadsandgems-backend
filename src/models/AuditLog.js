import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    adminUserId: String,
    adminEmail: String,
    action: { type: String, required: true },
    entity: String,
    entityId: String,
    summary: { type: String, required: true },
    changes: mongoose.Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
