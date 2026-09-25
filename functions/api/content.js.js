/**
 * GET /api/content.js
 *
 * The site's editable content as a plain script: `window.CONTENT = {...}`.
 * Served as JS on purpose so every page has it before js/site.js runs, with no
 * loading dance. Empty object when nothing has been edited yet.
 */
import { loadContent } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  let doc = {};
  try { doc = await loadContent(env); } catch (e) { console.error('content read failed', e); }
  const body = 'window.CONTENT = ' + JSON.stringify(doc) + ';';

  // Always revalidate: the moment Kam publishes, the next page load must show it.
  // The tag makes that revalidation a 304 rather than a re-download.
  const etag = 'W/"' + (doc.updated || 'empty') + ':' + body.length + '"';
  const headers = {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
    ETag: etag
  };
  if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { headers });
}
