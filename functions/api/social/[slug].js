/**
 * GET /api/social/:slug   -> { likes, comments }
 *
 * Public. Called when a visitor opens a painting.
 */
import { json } from '../../_lib/auth.js';
import { readSocial, publicView, okSlug } from '../../_lib/social.js';

export async function onRequestGet({ params, env }) {
  const slug = String(params.slug || '');
  if (!okSlug(slug)) return json({ error: 'Unknown painting.' }, 400);
  if (!env.CONTENT) return json({ likes: 0, comments: [] });
  try {
    return json(publicView(await readSocial(env, slug)));
  } catch (e) {
    console.error('social read failed', e);
    return json({ likes: 0, comments: [] });
  }
}
