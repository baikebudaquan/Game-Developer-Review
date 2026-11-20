-- D1 提交缓冲表，保留 7 天
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_sync',
  flags TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  dedupe_hash TEXT,
  next_attempt_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_status_next
  ON submissions (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_submissions_ip_created
  ON submissions (ip_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_submissions_dedupe
  ON submissions (dedupe_hash, created_at);
