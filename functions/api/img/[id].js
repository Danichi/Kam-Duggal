/**
 * GET /api/img/:id
 *
 * Serves an image Kam uploaded through the editor. Ids are random and the file
 * never changes under the same id, so it can be cached hard.
 */
export async function onRequestGet({ params, env }) {
  const id = String(params.id || '');
  if (!/^[a-f0-9]{32}\.(webp|jpg|png)$/.test(id)) return new Response('Not found', { status: 404 });
  if (!env.CONTENT) return new Response('Not found', { status: 404 });

  const { value, metadata } = await env.CONTENT.getWithMetadata('img:' + id, { type: 'arrayBuffer' });
  if (!value) return new Response('Not found', { status: 404 });

  return new Response(value, {
    headers: {
      'Content-Type': (metadata && metadata.type) || 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
