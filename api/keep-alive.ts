import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Pinged ~hourly by the uptime monitor (plus a daily 9:00 cron). Besides
// keeping Supabase warm, this enforces the house rule that a GLOBAL sold-out
// flag is always a mistake — Qendër must never lose a product ("E shitur"
// belongs only to the Cagllavicë-specific list). Any products.is_available =
// false row is flipped back here, so a wrong admin toggle survives at most
// one monitor ping instead of until midnight. Cagllavicë-only stock-outs
// (storefront_settings.cagllavice_unavailable_ids) are deliberately untouched.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const { data } = await supabase
    .from('products')
    .update({ is_available: true })
    .eq('is_available', false)
    .select('id');
  return res.status(200).json({ ok: true, reset: data?.length ?? 0 });
}
