/**
 * POST /api/admin/upload  (multipart/form-data: file, optional slug)
 *
 * Stores one already-resized image in KV and returns the URL to use for it.
 * The browser does the resizing (js/admin.js), so what arrives here is a small
 * web-ready file, not a 12 megapixel phone photo.
 */
import { session, json, sameOrigin, configured } from '../../../lib/auth.js';

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'Request not allowed.' }, 403);
  if (!configured(env)) return json({ error: 'The editor is not set up on this site yet.' }, 503);
  if (!(await session(request, env))) return json({ error: 'Please sign in.' }, 401);

  let form;
  try { form = await request.formData(); } catch { return json({ error: 'Could not read the upload.' }, 400); }

  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.size) return json({ error: 'No image came through.' }, 400);
  if (!TYPES[file.type]) return json({ error: 'Images need to be WebP, JPG or PNG.' }, 415);
  if (file.size > MAX_BYTES) return json({ error: 'That image is too big, even after resizing.' }, 413);

  const id = crypto.randomUUID().replace(/-/g, '') + '.' + TYPES[file.type];
  await env.CONTENT.put('img:' + id, await file.arrayBuffer(), {
    metadata: { type: file.type, name: String(form.get('name') || '').slice(0, 120), at: Date.now() }
  });

  return json({ ok: true, url: '/api/img/' + id });
}
