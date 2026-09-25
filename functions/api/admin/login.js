/**
 * POST /api/admin/login   { password }   -> sets the session cookie
 * GET  /api/admin/login                  -> { signedIn, configured }
 *
 * Wrong guesses are counted per IP in KV and locked out for 15 minutes.
 */
import { sameSecret, makeToken, cookieHeader, session, json, sameOrigin, configured } from '../../_lib/auth.js';

const MAX_TRIES = 8;
const WINDOW = 900; // seconds

export async function onRequestGet({ request, env }) {
  const s = await session(request, env);
  return json({ signedIn: Boolean(s), configured: configured(env) });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'Request not allowed.' }, 403);
  if (!configured(env)) return json({ error: 'The editor is not set up on this site yet.' }, 503);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const gateKey = `login:${ip}`;
  const tries = Number((await env.CONTENT.get(gateKey)) || 0);
  if (tries >= MAX_TRIES) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'Could not read that.' }, 400); }

  if (!sameSecret(body.password, env.ADMIN_PASSWORD)) {
    await env.CONTENT.put(gateKey, String(tries + 1), { expirationTtl: WINDOW });
    // slow down guessing a little without holding the worker open
    await new Promise(r => setTimeout(r, 600));
    return json({ error: 'That password is not right.' }, 401);
  }

  await env.CONTENT.delete(gateKey);
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(await makeToken(env)) });
}
