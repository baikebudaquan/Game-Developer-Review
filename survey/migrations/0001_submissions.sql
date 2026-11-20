-- 提交与审核表：D1 是唯一事实源
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending / approved / rejected
  flags TEXT,
  ip_hash TEXT,
  dedupe_hash TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewer TEXT,
  review_id TEXT,
  reject_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created
  ON submissions (status, created_at);

CREATE INDEX IF NOT EXISTS idx_submissions_ip_created
  ON submissions (ip_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_submissions_dedupe
  ON submissions (dedupe_hash, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,                     -- approve / reject
  reviewer TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  review_id TEXT,
  company_id TEXT,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_at
  ON audit_log (at);
