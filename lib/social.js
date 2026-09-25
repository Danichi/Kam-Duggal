/**
 * Likes and comments, kept in the same KV namespace as the site content.
 *
 *   social:<slug>   { likes, comments: [{ id, n, t, at, ok }] }
 *   social:pending  [{ slug, id }]        index, so moderation needs no key scan
 *   rl:<what>:<ip>  throttles, with a TTL
 *
 * Comments are held until Kam approves them, so nothing a stranger types
 * appears on his site on its own.
 */

export const KEY = slug => 'social:' + slug;
export const PENDING = 'social:pending';

export const MAX_NAME = 60;
export const MAX_TEXT = 1200;
export const MAX_PER_PAINTING = 200;

/** Painting slugs look like "new-voyage" or "piece-a1b2c3". */
export const okSlug = s => typeof s === 'string' && /^[a-z0-9][a-z0-9-]{0,80}$/i.test(s);

export const clean = (v, max) => String(v ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .trim()
  .slice(0, max);

export async function readSocial(env, slug) {
  const doc = await env.CONTENT.get(KEY(slug), 'json');
  return doc && typeof doc === 'object' ? { likes: doc.likes || 0, comments: doc.comments || [] } : { likes: 0, comments: [] };
}

export async function writeSocial(env, slug, doc) {
  await env.CONTENT.put(KEY(slug), JSON.stringify({ likes: doc.likes || 0, comments: (doc.comments || []).slice(-MAX_PER_PAINTING) }));
}

/** True when this IP has already done `what` inside the window. */
export async function throttled(env, request, what, seconds, limit = 1) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = 'rl:' + what + ':' + ip;
  const n = Number((await env.CONTENT.get(key)) || 0);
  if (n >= limit) return true;
  await env.CONTENT.put(key, String(n + 1), { expirationTtl: seconds });
  return false;
}

/** What the public is allowed to see. */
export const publicView = doc => ({
  likes: doc.likes || 0,
  comments: (doc.comments || []).filter(c => c.ok).map(c => ({ id: c.id, name: c.n, text: c.t, at: c.at }))
});
