import { authenticate, json, fail, readInt } from '../../../_lib/auth.js';
import { listSubmissions } from '../../../_lib/store.js';

export async function onRequestGet({ request, env }) {
  const session = await authenticate(request, env);
  if (session.error) return session.error;
  if (!env.DB) return fail(500, '缺少 D1 绑定 DB');

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';
  const limit = readInt(url.searchParams.get('limit'), 50, 1, 200);
  const offset = readInt(url.searchParams.get('offset'), 0, 0, 100000);

  const result = await listSubmissions(env.DB, { status, limit, offset });
  return json({ ok: true, ...result });
}
