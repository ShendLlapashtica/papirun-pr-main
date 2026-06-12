import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_ATTEMPTS = 5;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

interface ProfilePayload {
  emri?: string;
  mbiemri?: string;
  numriTelefonit?: string;
  vendbanimi?: string;
  latitude?: number | null;
  longitude?: number | null;
  lang?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const code = String(req.body?.code ?? '').trim();
  const profile = (req.body?.profile ?? null) as ProfilePayload | null;
  if (!email || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  // Latest unconsumed TAN for this email
  const { data: tan } = await supabase
    .from('auth_tans')
    .select('id, code_hash, expires_at, attempts')
    .eq('email', email)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tan || new Date(tan.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: 'expired' });
  }
  if (tan.attempts >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'too_many_attempts' });
  }

  if (tan.code_hash !== sha256(code)) {
    await supabase
      .from('auth_tans')
      .update({ attempts: tan.attempts + 1 })
      .eq('id', tan.id);
    return res.status(401).json({ error: 'invalid' });
  }

  // Code matches — consume it so it can never be replayed
  await supabase
    .from('auth_tans')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', tan.id);

  // Mint a session token hash WITHOUT any email: admin generateLink never
  // sends anything; the client exchanges hashed_token locally via verifyOtp.
  let linkData = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkData.error) {
    // User doesn't exist yet (signup) — create confirmed, then retry
    const { error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError && !/already.*registered|already.*exists/i.test(createError.message)) {
      return res.status(500).json({ error: 'user_create_failed' });
    }
    linkData = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
    if (linkData.error) {
      return res.status(500).json({ error: 'session_failed' });
    }
  }

  const user = linkData.data.user;
  const tokenHash = linkData.data.properties?.hashed_token;
  if (!tokenHash || !user) {
    return res.status(500).json({ error: 'session_failed' });
  }

  // Signup onboarding payload: upsert the profile row + keep auth metadata in
  // sync (AppHome greeting reads first_name). Best-effort — never block login.
  if (profile && (profile.emri || profile.mbiemri)) {
    await Promise.allSettled([
      supabase.from('profiles').upsert(
        {
          id: user.id,
          emri: profile.emri?.trim() || null,
          mbiemri: profile.mbiemri?.trim() || null,
          numri_telefonit: profile.numriTelefonit?.trim() || null,
          vendbanimi: profile.vendbanimi?.trim() || null,
          latitude: profile.latitude ?? null,
          longitude: profile.longitude ?? null,
        },
        { onConflict: 'id' }
      ),
      supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          first_name: profile.emri?.trim() || null,
          last_name: profile.mbiemri?.trim() || null,
          phone: profile.numriTelefonit?.trim() || null,
          lang: profile.lang ?? 'sq',
        },
      }),
    ]);
  }

  return res.status(200).json({ token_hash: tokenHash });
}
