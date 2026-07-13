import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RESTAURANT_COORDS = { lat: 42.6629, lng: 21.1655 };
const CAGLLAVICE_COORDS = { lat: 42.618, lng: 21.077 };
const TIMEZONE = 'Europe/Belgrade'; // Kosovo follows the same CET/CEST rules

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function suggestLocationId(lat: number | null, lng: number | null, address = ''): string {
  const addr = address.toLowerCase();
  if (addr.includes('çagllavic') || addr.includes('cagllavic')) return 'cagllavice';
  if (lat == null || lng == null) return 'qender';
  const dQ = haversineKm(lat, lng, RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng);
  const dC = haversineKm(lat, lng, CAGLLAVICE_COORDS.lat, CAGLLAVICE_COORDS.lng);
  return dC < dQ ? 'cagllavice' : 'qender';
}

async function isOpenNow(locationId: string): Promise<boolean> {
  const { data } = await supabase
    .from('storefront_locations')
    .select('open_days, open_minute, close_minute')
    .eq('id', locationId)
    .maybeSingle();
  if (!data) return true; // unknown location -> don't block the order

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date());
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = days.indexOf(parts.find((p) => p.type === 'weekday')?.value ?? 'Sun');
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10) % 24;
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const minuteOfDay = hour * 60 + minute;

  return (data.open_days ?? []).includes(day) && minuteOfDay >= data.open_minute && minuteOfDay < data.close_minute;
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

  let status: 'pending' | 'rejected' = 'pending';
  try {
    const locationId = b.locationId ?? suggestLocationId(b.deliveryLat ?? null, b.deliveryLng ?? null, String(b.deliveryAddress ?? ''));
    if (!(await isOpenNow(locationId))) status = 'rejected';
  } catch (e) {
    console.error('hours check failed, defaulting to open:', e);
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
    status,
    admin_note: status === 'rejected' ? 'Auto-refuzuar: jashte orarit te punes' : '',
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
