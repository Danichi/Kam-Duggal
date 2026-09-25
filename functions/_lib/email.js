/**
 * Outbound email for the server functions, via Resend (https://resend.com).
 *
 * Environment variables (Cloudflare Pages → Settings → Variables):
 *   RESEND_API_KEY   required in production
 *   EMAIL_FROM       e.g. "Kam Duggal Website <website@kamduggal.com>"; the
 *                    domain must be verified in Resend. Defaults to Resend's
 *                    shared test sender, which only delivers to your own inbox.
 *   INQUIRY_TO       where inquiries and reservations go (default kamdugal@aol.com)
 *   EMAIL_LOG_ONLY   "true" to log messages instead of sending (local testing)
 */

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function inbox(env) {
  return env.INQUIRY_TO || 'kamdugal@aol.com';
}

export function configured(env) {
  return Boolean(env.RESEND_API_KEY) || env.EMAIL_LOG_ONLY === 'true';
}

/** Branded, table-based HTML that survives Gmail/Outlook. */
export function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f2ece1;font-family:Helvetica,Arial,sans-serif;color:#0b0b0c">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2ece1;padding:32px 12px"><tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
    <tr><td style="background:#0b0b0c;padding:26px 32px;color:#f3eee4;font-family:Georgia,serif;font-size:22px;letter-spacing:4px">KAM DUGGAL <span style="color:#c9a45c;font-style:italic;letter-spacing:0">Original Art</span></td></tr>
    <tr><td style="padding:32px"><h1 style="margin:0 0 20px;font-family:Georgia,serif;font-weight:normal;font-size:26px">${esc(title)}</h1>${bodyHtml}</td></tr>
    <tr><td style="padding:20px 32px;border-top:1px solid #e6ddcc;font-size:12px;color:#6f6656">Sent from the inquiry form on kamduggal.com</td></tr>
  </table></td></tr></table></body></html>`;
}

export function fieldsTable(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">${rows
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `<tr><td style="padding:9px 12px 9px 0;border-bottom:1px solid #eee;color:#6f6656;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:9px 0;border-bottom:1px solid #eee;white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join('')}</table>`;
}

/**
 * @param {object} env
 * @param {{to:string|string[], subject:string, html:string, replyTo?:string, attachments?:{filename:string, content:string}[]}} msg
 *        attachment content is base64
 */
export async function send(env, msg) {
  if (env.EMAIL_LOG_ONLY === 'true' || !env.RESEND_API_KEY) {
    console.log('[email:log-only]', JSON.stringify({ to: msg.to, subject: msg.subject, replyTo: msg.replyTo, attachments: (msg.attachments || []).map(a => a.filename) }));
    return { ok: true, logged: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM || 'Kam Duggal Website <onboarding@resend.dev>',
      to: Array.isArray(msg.to) ? msg.to : [msg.to],
      subject: msg.subject,
      html: msg.html,
      reply_to: msg.replyTo,
      attachments: msg.attachments
    })
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
    return { ok: false };
  }
  return { ok: true };
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

/** Reject cross-site form posts. Same-origin fetches send a matching Origin. */
export function sameOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // some privacy tools strip it; the honeypot still applies
  const allowed = new Set([new URL(request.url).origin]);
  if (env.SITE_URL) allowed.add(new URL(env.SITE_URL).origin);
  return allowed.has(origin);
}
