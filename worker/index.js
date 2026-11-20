const API = 'https://api.github.com';
const MAX_ATTEMPTS = 8;

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(syncPending(env));
  },
  async fetch() {
    return new Response('gdr-sync-worker', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  },
};

async function syncPending(env) {
  const now = new Date().toISOString();
  const { results = [] } = await env.DB.prepare(
    `SELECT id, payload, attempts FROM submissions
     WHERE status = 'pending_sync' AND next_attempt_at <= ?
     ORDER BY created_at LIMIT 50`,
  ).bind(now).all();

  let synced = 0;
  for (const row of results) {
    try {
      await upload(env, row);
      await env.DB.prepare(
        "UPDATE submissions SET status = 'synced', synced_at = ?, attempts = attempts + 1 WHERE id = ?",
      ).bind(new Date().toISOString(), row.id).run();
      synced += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      const delayMinutes = Math.min(2 ** attempts, 60);
      const nextAttempt = new Date(Date.now() + delayMinutes * 60_000).toISOString();
      const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending_sync';
      await env.DB.prepare(
        'UPDATE submissions SET attempts = ?, next_attempt_at = ?, status = ? WHERE id = ?',
      ).bind(attempts, nextAttempt, status, row.id).run();
      console.error('同步失败', row.id, String(error));
    }
  }
  return synced;
}

function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'gdr-sync-worker',
    'Content-Type': 'application/json',
  };
}

function repository(env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
    throw new Error('缺少 GitHub 配置');
  }
  return { owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH || 'main' };
}

function base64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

async function upload(env, row) {
  if (!/^[0-9a-f-]{36}$/i.test(row.id)) throw new Error('非法的提交 ID');
  const { owner, repo, branch } = repository(env);
  const submittedAt = JSON.parse(row.payload).submittedAt || new Date().toISOString();
  const [year, month] = submittedAt.slice(0, 7).split('-');
  const path = `submissions/pending/${year}/${month}/${row.id}.json`;
  const url = `${API}/repos/${owner}/${repo}/contents/${path}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: githubHeaders(env),
    body: JSON.stringify({
      message: `data: add submission ${row.id}`,
      content: base64Utf8(row.payload + '\n'),
      branch,
    }),
  });
  if (response.ok) return;

  if (response.status === 409 || response.status === 422) {
    const check = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders(env) });
    if (check.ok) return;
  }
  throw new Error(`GitHub ${response.status}`);
}
