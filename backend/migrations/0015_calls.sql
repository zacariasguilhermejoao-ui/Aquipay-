CREATE TABLE IF NOT EXISTS calls (
 id TEXT PRIMARY KEY,
 conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 caller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 callee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 call_type TEXT NOT NULL CHECK(call_type IN ('voice','video')),
 status TEXT NOT NULL CHECK(status IN ('ringing','active','declined','ended','missed')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 answered_at TEXT,
 ended_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_calls_participants ON calls(caller_id,callee_id,status,created_at);
CREATE TABLE IF NOT EXISTS call_tickets (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 call_id TEXT REFERENCES calls(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_call_tickets_expiry ON call_tickets(expires_at);
