-- Google Play purchase audit and idempotency table.
-- purchase_token_hash stores a SHA-256 hash; raw purchase tokens are never persisted.
CREATE TABLE IF NOT EXISTS google_play_purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK(product_type IN ('inapp','subs')),
  purchase_token_hash TEXT NOT NULL UNIQUE,
  order_id TEXT,
  purchase_state TEXT NOT NULL DEFAULT 'pending' CHECK(purchase_state IN ('pending','purchased','cancelled','refunded','expired','revoked')),
  coins_granted INTEGER NOT NULL DEFAULT 0 CHECK(coins_granted >= 0),
  purchase_time_ms INTEGER,
  expiry_time_ms INTEGER,
  acknowledged INTEGER NOT NULL DEFAULT 0 CHECK(acknowledged IN (0,1)),
  verification_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_google_play_purchases_user ON google_play_purchases(user_id,created_at DESC);
