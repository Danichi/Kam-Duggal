/**
 * GET  /api/admin/comments                       -> every comment, newest first
 * POST /api/admin/comments { slug, id }          -> delete one
 * POST /api/admin/comments { action: 'seen' }    -> mark the panel as read
 *
 * Comments are live the moment they are written, so this is where Kam removes
 * the ones he does not want. `seen` is only used to put a count on the button.
 */
import { session, json, sameOrigin } from '../../../lib/auth.js';
import { readSocial, writeSocial, okSlug, SEEN } from '../../../lib/social.js';

export async function onRequestGet({ request, env }) {
  if (!(await session(request, env))) return json({ error: 'Please sign in.' }, 401);

  const seen = Number((await env.CONTENT.get(SEEN)) || 0);
  const comments = [];
  const list = await env.CONTENT.list({ prefix: 'social:' });
  for (const k of list.keys) {
    if (k.name === SEEN) continue;
    const slug = k.name.slice('social:'.length);
    const doc = await readSocial(env, slug);
    doc.comments.forEach(c => comments.push({ slug, id: c.id, name: c.n, text: c.t, at: c.at }));
  }
  comments.sort((a, b) => b.at - a.at);

  return json({ ok: true, comments, seen, fresh: comments.filter(c => c.at > seen).length });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'Request not allowed.' }, 403);
  if (!(await session(request, env))) return json({ error: 'Please sign in.' }, 401);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'Could not read that.' }, 400); }

  if (body.action === 'seen') {
    await env.CONTENT.put(SEEN, String(Date.now()));
    return json({ ok: true });
  }

  const { slug, id } = body;
  if (!okSlug(slug) || !id) return json({ error: 'Unknown comment.' }, 400);

  const doc = await readSocial(env, slug);
  const i = doc.comments.findIndex(c => c.id === id);
  if (i < 0) return json({ error: 'That comment is already gone.' }, 404);
  doc.comments.splice(i, 1);
  await writeSocial(env, slug, doc);

  return json({ ok: true });
}
