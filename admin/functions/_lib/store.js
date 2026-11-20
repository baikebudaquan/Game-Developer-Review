const REVIEW_ID = /^rv_[0-9A-Z]+$/;
const COMPANY_ID = /^c_[a-z0-9_-]+$/;

const conflict = status => ({ ok: false, code: 'conflict', status });
const notFound = () => ({ ok: false, code: 'not_found', status: 404 });
const invalid = message => ({ ok: false, code: 'invalid', status: 400, message });

export async function listSubmissions(db, { status = 'pending', limit = 50, offset = 0 } = {}) {
  const [list, total] = await Promise.all([
    db.prepare(
      'SELECT id, payload, status, flags, created_at FROM submissions WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    ).bind(status, limit, offset).all(),
    db.prepare('SELECT COUNT(*) AS count FROM submissions WHERE status = ?').bind(status).first(),
  ]);

  const items = [];
  for (const row of list.results || []) {
    let submission = null;
    try {
      submission = JSON.parse(row.payload);
    } catch {
      continue;
    }
    items.push({
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      flags: row.flags ? row.flags.split(',') : [],
      submission,
    });
  }

  return { items, total: total?.count || 0 };
}

export async function approveSubmission(db, { id, reviewId, companyId, reviewer }) {
  if (!REVIEW_ID.test(reviewId || '')) return invalid('reviewId 格式不合法');
  if (!COMPANY_ID.test(companyId || '')) return invalid('companyId 格式不合法');

  const row = await db.prepare('SELECT status, review_id FROM submissions WHERE id = ?').bind(id).first();
  if (!row) return notFound();
  if (row.status === 'approved') {
    return row.review_id === reviewId ? { ok: true, status: 'approved' } : conflict(row.status);
  }
  if (row.status !== 'pending') return conflict(row.status);

  const reviewedAt = new Date().toISOString();
  const result = await db.prepare(
    "UPDATE submissions SET status = 'approved', review_id = ?, reviewer = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'",
  ).bind(reviewId, reviewer, reviewedAt, id).run();
  if ((result.meta?.changes || 0) === 0) return conflict('pending');

  await db.prepare(
    "INSERT INTO audit_log (at, action, reviewer, submission_id, review_id, company_id) VALUES (?, 'approve', ?, ?, ?, ?)",
  ).bind(reviewedAt, reviewer, id, reviewId, companyId).run();

  return { ok: true, status: 'approved' };
}

export async function rejectSubmission(db, { id, reason, reviewer }) {
  const text = String(reason || '').trim();
  if (!text) return invalid('拒绝原因不能为空');
  if (text.length > 500) return invalid('拒绝原因不超过 500 字');

  const row = await db.prepare('SELECT status FROM submissions WHERE id = ?').bind(id).first();
  if (!row) return notFound();
  if (row.status === 'rejected') return { ok: true, status: 'rejected' };
  if (row.status !== 'pending') return conflict(row.status);

  const reviewedAt = new Date().toISOString();
  const result = await db.prepare(
    "UPDATE submissions SET status = 'rejected', reject_reason = ?, reviewer = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'",
  ).bind(text, reviewer, reviewedAt, id).run();
  if ((result.meta?.changes || 0) === 0) return conflict('pending');

  await db.prepare(
    "INSERT INTO audit_log (at, action, reviewer, submission_id, reason) VALUES (?, 'reject', ?, ?, ?)",
  ).bind(reviewedAt, reviewer, id, text).run();

  return { ok: true, status: 'rejected' };
}
