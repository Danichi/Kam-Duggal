/**
 * GET  /api/admin/content  -> the live content doc (no cache)
 * PUT  /api/admin/content  -> save it, keeping the previous version as a backup
 * POST /api/admin/content  { restore: true } -> put the backup back
 *
 * Signed-in only. The whole site's editable state is this one JSON document.
 */
import { session, json, sameOrigin, configured, loadContent, CONTENT_KEY } from '../../_lib/auth.js';

const BACKUP_KEY = 'content:previous';
/** Contact details. Only an address that looks like one, and a bare handle. */
function cleanSettings(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out = {};
  const email = String(v.email ?? '').trim().slice(0, 120);
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.email = email;
  const ig = String(v.instagram ?? '').trim().replace(/^@/, '').slice(0, 40);
  out.instagram = /^[A-Za-z0-9._]*$/.test(ig) ? ig : '';
  return out;
}

const MAX_BYTES = 900 * 1024; // KV allows 25MB; the doc is text only, so this is plenty

export async function onRequestGet({ request, env }) {
  if (!(await session(request, env))) return json({ error: 'Please sign in.' }, 401);
  return json({ ok: true, content: await loadContent(env) });
}

export async function onRequestPut({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'Request not allowed.' }, 403);
  if (!configured(env)) return json({ error: 'The editor is not set up on this site yet.' }, 503);
  if (!(await session(request, env))) return json({ error: 'Please sign in.' }, 401);

  let doc;
  try { doc = await request.json(); } catch { return json({ error: 'Could not read that.' }, 400); }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return json({ error: 'Unexpected content.' }, 400);

  // keep only the shapes the site knows how to read
  const clean = {
    v: 1,
    updated: new Date().toISOString(),
    text: doc.text && typeof doc.text === 'object' ? doc.text : {},
    paintings: Array.isArray(doc.paintings) ? doc.paintings : undefined,
    hero: Array.isArray(doc.hero) ? doc.hero.filter(s => typeof s === 'string').slice(0, 12) : undefined,
    images: doc.images && typeof doc.images === 'object' && !Array.isArray(doc.images) ? doc.images : undefined,
    layout: doc.layout && typeof doc.layout === 'object' && !Array.isArray(doc.layout) ? doc.layout : undefined,
    settings: cleanSettings(doc.settings)
  };
  const body = JSON.stringify(clean);
  if (body.length > MAX_BYTES) return json({ error: 'That is too much content to save at once.' }, 413);

  // Always leave a backup, even on the very first publish, so Undo can always
  // take the site back to how it was.
  const previous = (await env.CONTENT.get(CONTENT_KEY)) || JSON.stringify({ v: 1, text: {} });
  await env.CONTENT.put(BACKUP_KEY, previous);
  await env.CONTENT.put(CONTENT_KEY, body);
  return json({ ok: true, updated: clean.updated, hasBackup: Boolean(previous) });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'Request not allowed.' }, 403);
  if (!(await session(request, env))) return json({ error: 'Please sign in.' }, 401);

  let body = {};
  try { body = await request.json(); } catch {}
  if (!body.restore) return json({ error: 'Nothing to do.' }, 400);

  const previous = await env.CONTENT.get(BACKUP_KEY);
  if (!previous) return json({ error: 'There is no earlier version saved.' }, 404);
  const current = await env.CONTENT.get(CONTENT_KEY);
  await env.CONTENT.put(CONTENT_KEY, previous);
  if (current) await env.CONTENT.put(BACKUP_KEY, current); // so undo can be undone
  return json({ ok: true, content: JSON.parse(previous) });
}
