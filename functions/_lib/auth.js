/**
 * Session auth for the editor.
 *
 * One password, one cookie. The cookie is a signed token, so the server keeps
 * no session state: payload.HMAC-SHA256(payload, SESSION_SECRET).
 *
 * The password starts as the ADMIN_PASSWORD secret, but once Kam changes it
 * from the editor the new one is stored in KV as a salted PBKDF2 hash and that
 * takes over. A Worker cannot rewrite its own secret, which is why it moves to
 * KV rather than staying in the environment.
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

export const PASSWORD_KEY = 'auth:password';
const ITERATIONS = 25000;

/** Salted PBKDF2-SHA256. Returns the hash as base64url. */
async function derive(password, salt, iterations = ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, 256);
  return b64url(bits);
}

/** The stored password record, or null when it is still the env secret. */
export async function passwordRecord(env) {
  if (!env.CONTENT) return null;
  const rec = await env.CONTENT.get(PASSWORD_KEY, 'json');
  return rec && rec.hash && rec.salt ? rec : null;
}

/** True when this is the current password, whether it lives in KV or the env. */
export async function checkPassword(env, candidate) {
  const rec = await passwordRecord(env);
  if (!rec) return sameSecret(candidate, env.ADMIN_PASSWORD);
  const hash = await derive(candidate, unb64url(rec.salt), rec.iterations || ITERATIONS);
  return sameSecret(hash, rec.hash);
}

/** Store a new password. Also stamps the time, which signs other devices out. */
export async function setPassword(env, next) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await env.CONTENT.put(PASSWORD_KEY, JSON.stringify({
    salt: b64url(salt),
    hash: await derive(next, salt),
    iterations: ITERATIONS,
    at: Date.now()
  }));
}

export async function makeToken(env, user = 'kam') {
  const payload = b64url(enc.encode(JSON.stringify({ u: user, iat: Date.now(), exp: Date.now() + DAYS * 864e5 })));
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
  let data;
  try { data = JSON.parse(new TextDecoder().decode(unb64url(payload))); } catch { return null; }
  if (!(data.exp > Date.now())) return null;

  // changing the password signs out everything signed in before it
  const rec = await passwordRecord(env);
  if (rec && rec.at && !(data.iat >= rec.at)) return null;

  return data;
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
