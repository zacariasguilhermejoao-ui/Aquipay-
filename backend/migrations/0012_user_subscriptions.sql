-- Limites e estado de subscrição do AquiPay.
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','expired','revoked')),
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active ON user_subscriptions(user_id,status,expires_at);
