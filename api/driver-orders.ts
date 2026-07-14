import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Serves the same purpose as the driver_fetch_orders() Postgres RPC, but runs
// server-side with the service role key instead of depending on that DB
// function existing/matching in production — a prior incident (get_order_by_id)
// showed RPCs defined in migrations can be silently missing live.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const driverId = String(req.query.driverId ?? '');
  if (!driverId) return res.status(400).json({ error: 'missing driverId' });

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('assigned_driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data: data ?? [] });
}
