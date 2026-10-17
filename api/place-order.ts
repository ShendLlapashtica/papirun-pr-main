import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Inlined on purpose — do NOT turn this back into an import from
// ./order-validation. Vercel deployed place-order without resolving that
// sibling module at runtime, so every POST died with
// FUNCTION_INVOCATION_FAILED and no customer could check out (2026-10-17).
// api/order-validation.ts still holds the identical logic for the unit test;
// if you change one, change both.
interface ProductAvailability {
  id: string;
  is_available: boolean;
}

const getUnavailableProductIds = (
  requestedIds: string[],
  products: ProductAvailability[],
): string[] => {
  const availableIds = new Set(products.filter((product) => product.is_available).map((product) => product.id));
  return [...new Set(requestedIds)].filter((id) => !availableIds.has(id));
};

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

  if (
    !Array.isArray(b.items) ||
    b.items.length === 0 ||
    b.items.some((item: unknown) =>
      !item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'string' || !item.id.trim()
    )
  ) {
    return res.status(400).json({ code: 'invalid_items' });
  }

  const requestedProductIds = b.items.map((item: { id: string }) => item.id);
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, is_available')
    .in('id', requestedProductIds);

  if (productsError) {
    console.error('product availability check failed:', productsError);
    return res.status(500).json({ error: 'Could not verify product availability' });
  }

  const unavailableProductIds = getUnavailableProductIds(requestedProductIds, products ?? []);
  if (unavailableProductIds.length > 0) {
    return res.status(409).json({ code: 'unavailable_products', productIds: unavailableProductIds });
  }

  let status: 'pending' | 'rejected' = 'pending';
  const locationId = b.locationId ?? suggestLocationId(b.deliveryLat ?? null, b.deliveryLng ?? null, String(b.deliveryAddress ?? ''));
  try {
    if (!(await isOpenNow(locationId))) status = 'rejected';
  } catch (e) {
    console.error('hours check failed, defaulting to open:', e);
  }

  // Customer's payment preference (cash is the default and adds nothing).
  // POS and takeaway are carried as marker lines in notes — no schema
  // involvement; the admin UI derives its mini flags from these exact
  // strings. Must stay byte-identical to POS_NOTES_MARKER / TAKEAWAY_NOTES_MARKER
  // in src/lib/ordersApi.ts.
  const notes = String(b.notes ?? '');
  const notesWithPayment = b.paymentMethod === 'pos'
    ? `${notes ? `${notes}\n` : ''}💳 Pagesa: POS (Me Kartele)`
    : notes;
  const notesWithTakeaway = b.isTakeaway
    ? `${notesWithPayment ? `${notesWithPayment}\n` : ''}🥡 Merr vetë (Takeaway)`
    : notesWithPayment;

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
    notes: notesWithTakeaway,
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
