-- Relações de seguimento entre perfis profissionais.
CREATE TABLE user_follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);
CREATE INDEX idx_user_follows_followed ON user_follows(followed_id, created_at DESC);
CREATE INDEX idx_user_follows_follower ON user_follows(follower_id, created_at DESC);
