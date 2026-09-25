/**
 * Session auth for the editor.
 *
 * One password (ADMIN_PASSWORD), one cookie. The cookie is a signed token, so
 * the server keeps no session state: payload.HMAC-SHA256(payload, SESSION_SECRET).
 *
 * Env: ADMIN_PASSWORD (required), SESSION_SECRET (required), SITE_URL (optional)
 */

const COOKIE = 'kd_session';
const DAYS = 30;
const enc = new TextEncoder();

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, c => c.charCodeAt(0));
};

async function key(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** Constant-time string compare, so a wrong password leaks nothing by timing. */
export function sameSecret(a, b) {
  const x = enc.encode(String(a ?? ''));
  const y = enc.encode(String(b ?? ''));
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function makeToken(env, user = 'kam') {
  const payload = b64url(enc.encode(JSON.stringify({ u: user, exp: Date.now() + DAYS * 864e5 })));
  const sig = b64url(await crypto.subtle.sign('HMAC', await key(env.SESSION_SECRET), enc.encode(payload)));
  return `${payload}.${sig}`;
}

export async function readToken(env, token) {
  if (!token || !env.SESSION_SECRET) return null;
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await key(env.SESSION_SECRET), unb64url(sig), enc.encode(payload)); } catch { return null; }
  if (!ok) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}

export function cookieHeader(token) {
  return token
    ? `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`
    : `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function tokenFrom(request) {
  const raw = request.headers.get('Cookie') || '';
  const hit = raw.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  return hit ? hit.slice(COOKIE.length + 1) : null;
}

/** Returns the session, or null. Use for every admin endpoint. */
export async function session(request, env) {
  return readToken(env, tokenFrom(request));
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }
  });
}

/** Reject cross-site writes. Same-origin fetches send a matching Origin. */
export function sameOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  const allowed = new Set([new URL(request.url).origin]);
  if (env.SITE_URL) allowed.add(new URL(env.SITE_URL).origin);
  return allowed.has(origin);
}

export function configured(env) {
  return Boolean(env.ADMIN_PASSWORD && env.SESSION_SECRET && env.CONTENT);
}

export const CONTENT_KEY = 'content';

/** The stored site content, or an empty doc. */
export async function loadContent(env) {
  if (!env.CONTENT) return {};
  return (await env.CONTENT.get(CONTENT_KEY, 'json')) || {};
}
