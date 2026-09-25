/**
 * GET /api/social   -> { "slug": { likes, comments }, … }
 *
 * Counts for the whole gallery in one request, so every tile can show its
 * likes without asking for each painting separately. Only paintings someone
 * has actually liked or commented on have a key, so this stays small.
 */
import { json } from '../../_lib/auth.js';
import { readSocial, SEEN } from '../../_lib/social.js';

export async function onRequestGet({ env }) {
  if (!env.CONTENT) return json({});

  const out = {};
  let cursor;
  do {
    const page = await env.CONTENT.list({ prefix: 'social:', cursor });
    for (const k of page.keys) {
      if (k.name === SEEN) continue;
      const slug = k.name.slice('social:'.length);
      const doc = await readSocial(env, slug);
      if (doc.likes || doc.comments.length) out[slug] = { likes: doc.likes || 0, comments: doc.comments.length };
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);

  return new Response(JSON.stringify(out), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'max-age=0, must-revalidate' }
  });
}
