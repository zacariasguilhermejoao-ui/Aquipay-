-- AquiPay: identity verification sessions and Didit webhook audit.
ALTER TABLE users ADD COLUMN identity_verified_at TEXT;

CREATE TABLE IF NOT EXISTS identity_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Not Started',
  session_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_user_created
  ON identity_verifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS identity_webhook_events (
  event_key TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_identity_webhook_session
  ON identity_webhook_events(session_id);
