const mongoose = require('mongoose');
const { createModel } = require('../config/modelAdapter');

const driveBackupLogSchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  action: {
    type: String,
    enum: ['auto_export', 'manual_sync', 'retry_failed', 'historical_export', 'test_connection'],
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'partial', 'not_configured'],
    required: true
  },
  year: { type: String },
  month: { type: String },
  fileName: { type: String },
  fileId: { type: String },
  transactionType: { type: String },
  transactionId: { type: String },
  recordsProcessed: { type: Number, default: 0 },
  details: { type: String },
  error: { type: String },
  triggeredBy: { type: String, default: 'System' },
  durationMs: { type: Number, default: 0 }
}, {
  timestamps: true
});

const DriveBackupLog = mongoose.model('DriveBackupLog', driveBackupLogSchema);
module.exports = createModel('drive_backup_logs', DriveBackupLog);
