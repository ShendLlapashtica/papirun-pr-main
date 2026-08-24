import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Daily safety net: whatever got marked unavailable (globally, or the wrong
// toggle by mistake) goes back to available at 00:00 so a stock issue never
// silently persists past the day it happened. Cagllavice-only unavailability
// (cagllavice_unavailable_ids, a storefront_settings row) is untouched — this
// only resets the global is_available flag.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { data, error } = await supabase
    .from('products')
    .update({ is_available: true })
    .eq('is_available', false)
    .select('id');

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ reset: data?.length ?? 0 });
}
