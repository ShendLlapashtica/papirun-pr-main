import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const b = req.body ?? {};

  const required = ['customerName', 'customerPhone', 'deliveryAddress', 'items', 'subtotal', 'total'];
  for (const field of required) {
    if (b[field] === undefined || b[field] === null || b[field] === '') {
      return res.status(400).json({ error: `missing field: ${field}` });
    }
  }

  const payload = {
    user_id: b.userId ?? null,
    customer_name: String(b.customerName),
    customer_phone: String(b.customerPhone),
    delivery_address: String(b.deliveryAddress),
    delivery_lat: b.deliveryLat ?? null,
    delivery_lng: b.deliveryLng ?? null,
    location_id: b.locationId ?? null,
    items: b.items,
    subtotal: Number(b.subtotal),
    delivery_fee: Number(b.deliveryFee ?? 0),
    total: Number(b.total),
    notes: b.notes ?? '',
    status: 'pending',
    source: b.source ?? 'web',
  };

  const { data, error } = await supabase
    .from('orders')
    .insert(payload)
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
}
