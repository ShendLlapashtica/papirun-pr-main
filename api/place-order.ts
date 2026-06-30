import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const Q = { lat: 42.6629, lng: 21.1655 };
const C = { lat: 42.6280, lng: 21.1730 };

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function pickBranch(lat: number | null, lng: number | null, address: string): Promise<'qender' | 'cagllavice'> {
  if (address.toLowerCase().includes('cagllavic')) return 'cagllavice';
  if (lat == null || lng == null) return 'qender';
  try {
    const url = `https://router.project-osrm.org/table/v1/driving/${lng},${lat};${Q.lng},${Q.lat};${C.lng},${C.lat}?sources=0&destinations=1,2&annotations=duration`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const j = await r.json() as { durations: number[][] };
      const [dQ, dC] = j.durations[0];
      return dC < dQ ? 'cagllavice' : 'qender';
    }
  } catch { /* fall through to Haversine */ }
  return haversineKm(lat, lng, C.lat, C.lng) < haversineKm(lat, lng, Q.lat, Q.lng) ? 'cagllavice' : 'qender';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const b = req.body ?? {};

  const required = ['customerName', 'customerPhone', 'deliveryAddress', 'items', 'subtotal', 'total'];
  for (const field of required) {
    if (b[field] === undefined || b[field] === null || b[field] === '') {
      return res.status(400).json({ error: `missing field: ${field}` });
    }
  }

  const deliveryLat: number | null = b.deliveryLat ?? null;
  const deliveryLng: number | null = b.deliveryLng ?? null;
  const suggested_location = await pickBranch(deliveryLat, deliveryLng, String(b.deliveryAddress));

  const payload = {
    user_id: b.userId ?? null,
    customer_name: String(b.customerName),
    customer_phone: String(b.customerPhone),
    delivery_address: String(b.deliveryAddress),
    delivery_lat: deliveryLat,
    delivery_lng: deliveryLng,
    location_id: b.locationId ?? null,
    items: b.items,
    subtotal: Number(b.subtotal),
    delivery_fee: Number(b.deliveryFee ?? 0),
    total: Number(b.total),
    notes: b.notes ?? '',
    status: 'pending',
    source: b.source ?? 'web',
    suggested_location,
  };

  const { data, error } = await supabase
    .from('orders')
    .insert(payload)
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
}
