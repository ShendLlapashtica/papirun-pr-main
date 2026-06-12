import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, randomInt } from 'crypto';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FROM = 'Papirun <auth@papirun.net>';
const CODE_TTL_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_PER_HOUR = 5;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const buildEmail = (code: string, lang: string) => {
  const sq = lang !== 'en';
  const subject = sq
    ? `${code} — Kodi juaj i verifikimit Papirun`
    : `${code} — Your Papirun verification code`;
  const intro = sq ? 'Kodi juaj i verifikimit është:' : 'Your verification code is:';
  const expiry = sq ? 'Kodi skadon për 5 minuta.' : 'This code expires in 5 minutes.';
  const ignore = sq
    ? 'Nëse nuk e keni kërkuar këtë kod, injoroni këtë email.'
    : "If you didn't request this code, ignore this email.";
  // Raw, link-free email: the 6 digits and nothing clickable.
  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f6f7f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:420px;margin:24px auto;background:#ffffff;border-radius:16px;padding:32px;text-align:center;">
    <p style="font-size:18px;font-weight:bold;margin:0 0 4px;">Papirun</p>
    <p style="font-size:12px;color:#888;margin:0 0 24px;">House of Crunch</p>
    <p style="font-size:14px;color:#333;margin:0 0 16px;">${intro}</p>
    <p style="font-size:40px;font-weight:bold;letter-spacing:10px;font-family:'Courier New',monospace;margin:0 0 16px;color:#111;">${code}</p>
    <p style="font-size:12px;color:#888;margin:0 0 8px;">${expiry}</p>
    <p style="font-size:11px;color:#bbb;margin:0;">${ignore}</p>
  </div>
</body></html>`;
  const text = `Papirun\n\n${intro}\n\n${code}\n\n${expiry}\n${ignore}`;
  return { subject, html, text };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return res.status(503).json({ error: 'email_not_configured' });
  }

  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const lang = String(req.body?.lang ?? 'sq');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  // Hard-bounced / complained addresses never get mail again
  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (suppressed) return res.status(400).json({ error: 'suppressed' });

  // Rate limits: 60s cooldown between sends, max 5 codes per rolling hour
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { data: recent } = await supabase
    .from('auth_tans')
    .select('created_at')
    .eq('email', email)
    .gte('created_at', hourAgo)
    .order('created_at', { ascending: false });
  if (recent && recent.length > 0) {
    const lastMs = new Date(recent[0].created_at).getTime();
    const sinceMs = Date.now() - lastMs;
    if (sinceMs < COOLDOWN_MS) {
      return res.status(429).json({
        error: 'cooldown',
        wait: Math.ceil((COOLDOWN_MS - sinceMs) / 1000),
      });
    }
    if (recent.length >= MAX_PER_HOUR) {
      return res.status(429).json({ error: 'limit' });
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error: insertError } = await supabase.from('auth_tans').insert({
    email,
    code_hash: sha256(code),
    expires_at: expiresAt,
  });
  if (insertError) return res.status(500).json({ error: 'db_error' });

  const { subject, html, text } = buildEmail(code, lang);
  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [email], subject, html, text }),
  });

  const logStatus = sendRes.ok ? 'sent' : 'failed';
  const sendBody = sendRes.ok ? null : (await sendRes.text()).slice(0, 1000);
  await supabase.from('email_send_log').insert({
    template_name: 'tan',
    recipient_email: email,
    status: logStatus,
    error_message: sendBody,
  });

  if (!sendRes.ok) {
    return res.status(502).json({ error: 'send_failed' });
  }
  return res.status(200).json({ ok: true });
}
