/**
 * GET  /api/admin/comments                      -> everything waiting, plus what is live
 * POST /api/admin/comments { slug, id, action } -> approve | delete
 *
 * Signed in only. Approving is what puts a comment on the site.
 */
import { session, json, sameOrigin } from '../../../lib/auth.js';
import { readSocial, writeSocial, okSlug, PENDING } from '../../../lib/social.js';

export async function onRequestGet({ request, env }) {
  if (!(await session(request, env))) return json({ error: 'Please sign in.' }, 401);

  const pending = (await env.CONTENT.get(PENDING, 'json')) || [];
  const slugs = [...new Set(pending.map(x => x.slug))];
  const waiting = [];
  for (const slug of slugs) {
    const doc = await readSocial(env, slug);
    doc.comments.filter(c => !c.ok).forEach(c => waiting.push({ slug, id: c.id, name: c.n, text: c.t, at: c.at }));
  }

  // what is already showing, so he can take one down later
  const live = [];
  const list = await env.CONTENT.list({ prefix: 'social:' });
  for (const k of list.keys) {
    if (k.name === PENDING) continue;
    const slug = k.name.slice('social:'.length);
    const doc = await readSocial(env, slug);
    doc.comments.filter(c => c.ok).forEach(c => live.push({ slug, id: c.id, name: c.n, text: c.t, at: c.at }));
    if (doc.likes) live.likes = true;
  }

  return json({ ok: true, waiting: waiting.sort((a, b) => b.at - a.at), live: live.sort((a, b) => b.at - a.at) });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'Request not allowed.' }, 403);
  if (!(await session(request, env))) return json({ error: 'Please sign in.' }, 401);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'Could not read that.' }, 400); }
  const { slug, id, action } = body;
  if (!okSlug(slug) || !id) return json({ error: 'Unknown comment.' }, 400);
  if (!['approve', 'delete'].includes(action)) return json({ error: 'Unknown action.' }, 400);

  const doc = await readSocial(env, slug);
  const i = doc.comments.findIndex(c => c.id === id);
  if (i < 0) return json({ error: 'That comment is already gone.' }, 404);

  if (action === 'approve') doc.comments[i].ok = true;
  else doc.comments.splice(i, 1);
  await writeSocial(env, slug, doc);

  const pending = (await env.CONTENT.get(PENDING, 'json')) || [];
  await env.CONTENT.put(PENDING, JSON.stringify(pending.filter(x => !(x.slug === slug && x.id === id))));

  return json({ ok: true });
}
