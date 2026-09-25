/**
 * POST /api/admin/password   { current, next }
 *
 * Changes the editor password. The new one is stored in KV as a salted hash
 * and takes over from the ADMIN_PASSWORD secret, which a Worker cannot rewrite.
 *
 * Changing it signs out every other device, so this reply carries a fresh
 * cookie to keep the browser doing the changing signed in.
 */
import { checkPassword, setPassword, makeToken, cookieHeader, session, json, sameOrigin, configured } from '../../_lib/auth.js';

const MIN = 10;
const MAX = 200;

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'Request not allowed.' }, 403);
  if (!configured(env)) return json({ error: 'The editor is not set up on this site yet.' }, 503);
  if (!(await session(request, env))) return json({ error: 'Please sign in.' }, 401);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'Could not read that.' }, 400); }

  const current = String(body.current ?? '');
  const next = String(body.next ?? '');

  if (!(await checkPassword(env, current))) {
    await new Promise(r => setTimeout(r, 600));
    return json({ error: 'That is not your current password.' }, 401);
  }
  if (next.length < MIN) return json({ error: `Use at least ${MIN} characters.` }, 400);
  if (next.length > MAX) return json({ error: 'That is too long.' }, 400);
  if (next.trim() !== next) return json({ error: 'No spaces at the start or end, they are too easy to lose.' }, 400);
  if (next === current) return json({ error: 'That is the password you already have.' }, 400);

  await setPassword(env, next);

  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(await makeToken(env)) });
}
