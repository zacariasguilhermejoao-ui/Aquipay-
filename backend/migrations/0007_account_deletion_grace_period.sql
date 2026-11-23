-- 30-day grace period before permanent account deletion.
ALTER TABLE users ADD COLUMN deletion_requested_at TEXT;
ALTER TABLE users ADD COLUMN deletion_due_at TEXT;
CREATE INDEX IF NOT EXISTS idx_users_deletion_due
  ON users(deletion_due_at)
  WHERE deletion_due_at IS NOT NULL;
