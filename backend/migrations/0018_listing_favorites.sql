CREATE TABLE IF NOT EXISTS listing_favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX IF NOT EXISTS idx_listing_favorites_user_created
  ON listing_favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_favorites_listing
  ON listing_favorites(listing_id);
