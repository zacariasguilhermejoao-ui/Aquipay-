CREATE TABLE IF NOT EXISTS email_action_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('password_reset','password_change','email_change','account_delete')),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, purpose)
);
CREATE INDEX IF NOT EXISTS idx_email_action_codes_expiry ON email_action_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_action_codes_user_purpose ON email_action_codes(user_id, purpose);