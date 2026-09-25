/** POST /api/admin/logout — clears the session cookie. */
import { cookieHeader, json, sameOrigin } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'Request not allowed.' }, 403);
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(null) });
}
