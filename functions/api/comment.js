/**
 * POST /api/comment   { slug, name, text, website }   -> { ok: true }
 *
 * The comment is stored unapproved and shows to nobody until Kam approves it in
 * the editor. `website` is a honeypot: real people never fill it in.
 */
import { json, sameOrigin } from '../../lib/auth.js';
import { readSocial, writeSocial, okSlug, clean, throttled, PENDING, MAX_NAME, MAX_TEXT } from '../../lib/social.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'Request not allowed.' }, 403);
  if (!env.CONTENT) return json({ error: 'Comments are not available right now.' }, 503);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'Could not read that.' }, 400); }
  if (clean(body.website, 20)) return json({ ok: true });            // honeypot

  const slug = String(body.slug || '');
  const name = clean(body.name, MAX_NAME);
  const text = clean(body.text, MAX_TEXT);
  if (!okSlug(slug)) return json({ error: 'Unknown painting.' }, 400);
  if (!name) return json({ error: 'Please add your name.' }, 400);
  if (text.length < 2) return json({ error: 'Please write a comment.' }, 400);

  // five comments an hour from one address is plenty
  if (await throttled(env, request, 'cmt', 3600, 5)) {
    return json({ error: 'That is a few comments in a row. Try again a little later.' }, 429);
  }

  const doc = await readSocial(env, slug);
  const id = crypto.randomUUID().slice(0, 8);
  doc.comments.push({ id, n: name, t: text, at: Date.now(), ok: false });
  await writeSocial(env, slug, doc);

  const pending = (await env.CONTENT.get(PENDING, 'json')) || [];
  pending.push({ slug, id });
  await env.CONTENT.put(PENDING, JSON.stringify(pending.slice(-300)));

  return json({ ok: true, held: true });
}
