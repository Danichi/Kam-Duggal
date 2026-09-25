/**
 * POST /api/like   { slug }   -> { likes }
 *
 * One like per person per painting per day, checked by IP. The browser also
 * remembers, so the heart stays filled when they come back.
 */
import { json, sameOrigin } from '../../lib/auth.js';
import { readSocial, writeSocial, okSlug, throttled } from '../../lib/social.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'Request not allowed.' }, 403);
  if (!env.CONTENT) return json({ error: 'Not available.' }, 503);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'Could not read that.' }, 400); }
  const slug = String(body.slug || '');
  if (!okSlug(slug)) return json({ error: 'Unknown painting.' }, 400);

  const doc = await readSocial(env, slug);

  // already liked today: hand back the count without adding another
  if (await throttled(env, request, 'like:' + slug, 86400)) return json({ likes: doc.likes, already: true });

  doc.likes = (doc.likes || 0) + 1;
  await writeSocial(env, slug, doc);
  return json({ likes: doc.likes });
}
