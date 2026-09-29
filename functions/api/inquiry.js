/**
 * POST /api/inquiry  (multipart/form-data)
 *
 * The collector / commission inquiry form on artist.html. Emails Kam with the
 * visitor as reply-to, so he can answer straight from his inbox.
 *
 * Env: RESEND_API_KEY, EMAIL_FROM, INQUIRY_TO, EMAIL_LOG_ONLY (see lib/email.js)
 */

import { send, configured, inbox, layout, fieldsTable, json, sameOrigin, esc } from '../_lib/email.js';

const INTERESTS = ['Buying an original', 'Commission', 'Prints', 'Something else'];
const FIELDS = [
  ['interest', 'Interested in', { required: true, oneOf: INTERESTS }],
  ['piece', 'Painting', { max: 120 }],
  ['piece_title', 'Painting title', { max: 160 }],
  ['name', 'Name', { required: true, max: 120 }],
  ['email', 'Email', { required: true, type: 'email', max: 160 }],
  ['phone', 'Phone', { max: 40 }],
  ['city', 'City / state', { max: 80 }],
  ['message', 'Message', { required: true, max: 5000 }]
];

const clean = v => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
const titleCase = slug => slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'Request not allowed.' }, 403);
  if (!configured(env)) {
    console.error('Email is not configured (RESEND_API_KEY).');
    return json({ error: `The form is temporarily unavailable. Please email ${await inbox(env)}.` }, 503);
  }

  let form;
  try { form = await request.formData(); } catch { return json({ error: 'Could not read the form.' }, 400); }
  if (clean(form.get('website'))) return json({ ok: true }); // honeypot

  const values = {};
  const fields = {};
  for (const [name, label, rule] of FIELDS) {
    const v = clean(form.get(name));
    if (rule.required && !v) { fields[name] = `${label} is required.`; continue; }
    if (!v) continue;
    if (rule.max && v.length > rule.max) fields[name] = `${label} is too long.`;
    if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) fields[name] = 'Please enter a valid email address.';
    if (rule.oneOf && !rule.oneOf.includes(v)) fields[name] = 'Please choose an option.';
    values[name] = v;
  }
  if (Object.keys(fields).length) return json({ error: 'Please check the highlighted fields.', fields }, 400);

  const piece = values.piece_title || (values.piece ? titleCase(values.piece) : '');
  const origin = new URL(request.url).origin;
  const rows = FIELDS.filter(([n]) => n !== 'piece_title').map(([n, label]) => [label, n === 'piece' ? piece : values[n]]);
  const link = values.piece ? `<p style="font-size:14px"><a href="${origin}/originals.html#${encodeURIComponent(values.piece)}">View the painting on the site</a></p>` : '';

  const result = await send(env, {
    to: await inbox(env),
    replyTo: values.email,
    subject: `${values.interest}${piece ? `: ${piece}` : ''} (from ${values.name})`.slice(0, 200),
    html: layout('New website inquiry', `<p style="font-size:14px;line-height:1.6">Reply to this email to answer ${esc(values.name)} directly.</p>${fieldsTable(rows)}${link}`)
  });

  if (!result.ok) return json({ error: `We could not send your message. Please email ${await inbox(env)}.` }, 502);
  return json({ ok: true });
}
