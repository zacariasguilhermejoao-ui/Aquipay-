-- Google Play Billing: tokens únicos para impedir creditação duplicada.
CREATE TABLE IF NOT EXISTS google_play_purchases (
  purchase_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  purchase_type TEXT NOT NULL CHECK(purchase_type IN ('coins','plus')),
  order_id TEXT,
  coins_granted INTEGER NOT NULL DEFAULT 0 CHECK(coins_granted >= 0),
  status TEXT NOT NULL CHECK(status IN ('verified','refunded','revoked')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_google_play_purchases_user ON google_play_purchases(user_id,created_at DESC);
