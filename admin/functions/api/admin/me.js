import { authenticate, json } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const session = await authenticate(request, env);
  if (session.error) return session.error;
  return json({ ok: true, login: session.login });
}
