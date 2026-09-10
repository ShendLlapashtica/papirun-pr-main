import { supabase } from '@/integrations/supabase/client';
import type { CartItem } from '@/types/menu';
import { haversineKm, RESTAURANT_COORDS, CAGLLAVICE_COORDS } from '@/lib/driversApi';

export type OrderStatus = 'pending' | 'approved' | 'preparing' | 'out_for_delivery' | 'rejected' | 'completed' | 'histori';
export type OrderSource = 'web' | 'app';
export type OrderLocation = 'qender' | 'cagllavice';
export type PaymentMethod = 'cash' | 'pos';

/**
 * POS orders are tagged with this exact line inside `notes` by /api/place-order.
 * No DB column involved — the admin UI derives its mini POS flag from this
 * marker and strips it from the visible note text. Must stay byte-identical
 * to the literal in api/place-order.ts.
 */
export const POS_NOTES_MARKER = '💳 Pagesa: POS (Me Kartele)';

/**
 * Set when Çagllavicë hands one specific order over to Qendra: the order's
 * location_id flips to 'qender' (so it re-files under Qendra everywhere) and
 * this line is appended to notes so the customer's tracking can say
 * "Porosia juaj po përpunohet nga Papirun Qendër!".
 */
export const FORWARDED_NOTES_MARKER = '📍 Porosia u kalua te Qendra';

/** Customer note with internal marker lines removed — badges/notices carry that info instead. */
export const stripPosMarker = (notes: string | null | undefined): string =>
  (notes ?? '')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return t !== POS_NOTES_MARKER && t !== FORWARDED_NOTES_MARKER;
    })
    .join('\n')
    .trim();

export function suggestOrderLocation(lat: number | null, lng: number | null, address = ''): OrderLocation {
  const addr = address.toLowerCase();
  if (addr.includes('çagllavic') || addr.includes('cagllavic')) return 'cagllavice';
  if (lat == null || lng == null) return 'qender';
  const dQ = haversineKm(lat, lng, RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng);
  const dC = haversineKm(lat, lng, CAGLLAVICE_COORDS.lat, CAGLLAVICE_COORDS.lng);
  return dC < dQ ? 'cagllavice' : 'qender';
}

export interface OrderStatusEvent {
  status: OrderStatus;
  note: string;
  at: string;
}

export interface OrderRecord {
  id: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  locationId: string | null;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  adminNote: string;
  notes: string;
  statusHistory: OrderStatusEvent[];
  source: OrderSource;
  paymentMethod: PaymentMethod;
  /** True when Çagllavicë handed this order to Qendra (see FORWARDED_NOTES_MARKER) */
  forwardedToQender: boolean;
  prepEtaMinutes: number | null;
  isVisible: boolean;
  assignedDriverId?: string | null;
  driverRating?: number | null;
  suggestedLocation: OrderLocation;
  nrPorosia: number | null;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  location_id: string | null;
  items: CartItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  admin_note: string;
  notes: string;
  status_history: OrderStatusEvent[] | null;
  source: OrderSource | null;
  prep_eta_minutes: number | null;
  is_visible: boolean | null;
  assigned_driver_id?: string | null;
  driver_rating?: number | null;
  suggested_location?: string | null;
  nr_porosia?: number | null;
  created_at: string;
  updated_at: string;
};

const TABLE = 'orders';

const mapRow = (row: Row): OrderRecord => ({
  id: row.id,
  userId: row.user_id,
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  deliveryAddress: row.delivery_address,
  deliveryLat: row.delivery_lat !== null ? Number(row.delivery_lat) : null,
  deliveryLng: row.delivery_lng !== null ? Number(row.delivery_lng) : null,
  locationId: row.location_id,
  items: Array.isArray(row.items) ? row.items : [],
  subtotal: Number(row.subtotal),
  deliveryFee: Number(row.delivery_fee),
  total: Number(row.total),
  status: row.status,
  adminNote: row.admin_note,
  notes: row.notes,
  statusHistory: Array.isArray(row.status_history) ? row.status_history : [],
  source: (row.source ?? 'web') as OrderSource,
  // Derived from notes markers (no DB columns for these) — see the marker constants
  paymentMethod: (row.notes ?? '').includes(POS_NOTES_MARKER) ? 'pos' : 'cash',
  forwardedToQender: (row.notes ?? '').includes(FORWARDED_NOTES_MARKER),
  prepEtaMinutes: row.prep_eta_minutes,
  isVisible: row.is_visible !== false,
  assignedDriverId: row.assigned_driver_id,
  driverRating: row.driver_rating,
  // Use DB column when present (after migration); fall back to coords+address for old/unmigrated orders
  suggestedLocation: (row.suggested_location === 'cagllavice' || row.suggested_location === 'qender')
    ? row.suggested_location as OrderLocation
    : suggestOrderLocation(row.delivery_lat ?? null, row.delivery_lng ?? null, row.delivery_address || ''),
  nrPorosia: row.nr_porosia ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface CreateOrderInput {
  userId?: string | null;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  locationId?: string | null;
  items: CartItem[];
  subtotal: number;
  deliveryFee?: number;
  total: number;
  notes?: string;
  source?: OrderSource;
  paymentMethod?: PaymentMethod;
}

export const detectOrderSource = (): OrderSource => {
  try {
    if (typeof window === 'undefined') return 'web';
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      // iOS Safari
      (window.navigator as any).standalone === true;
    return standalone ? 'app' : 'web';
  } catch { return 'web'; }
};

export const createOrder = async (input: CreateOrderInput): Promise<OrderRecord> => {
  const res = await fetch('/api/place-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: input.userId ?? null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      deliveryAddress: input.deliveryAddress,
      deliveryLat: input.deliveryLat,
      deliveryLng: input.deliveryLng,
      locationId: input.locationId ?? null,
      items: input.items,
      subtotal: input.subtotal,
      deliveryFee: input.deliveryFee ?? 0,
      total: input.total,
      notes: input.notes ?? '',
      source: input.source ?? detectOrderSource(),
      paymentMethod: input.paymentMethod ?? 'cash',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown' }));
    throw new Error(err.error ?? 'Order creation failed');
  }
  const data = await res.json();
  return mapRow(data as Row);
};

export const fetchOrder = async (id: string): Promise<OrderRecord | null> => {
  const client = supabase as any;
  const { data, error } = await client.rpc('get_order_by_id', { p_order_id: id }).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Row) : null;
};

export const fetchAllOrders = async (): Promise<OrderRecord[]> => {
  const client = supabase as any;
  const { data, error } = await client.from(TABLE).select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data as Row[]).map(mapRow);
};

export const updateOrderStatus = async (id: string, status: OrderStatus, adminNote = '') => {
  const client = supabase as any;
  const { error } = await client.from(TABLE).update({ status, admin_note: adminNote }).eq('id', id);
  if (error) throw error;
};

export const setOrderEta = async (id: string, minutes: number | null) => {
  const client = supabase as any;
  const { error } = await client.from(TABLE).update({ prep_eta_minutes: minutes }).eq('id', id);
  if (error) throw error;
};

export const deleteOrder = async (id: string) => {
  const client = supabase as any;
  const { error } = await client.from(TABLE).update({ status: 'histori', is_visible: false }).eq('id', id);
  if (error) throw error;
};

/**
 * Çagllavicë hands ONE specific order over to Qendra: same order (never a
 * copy) re-files under Qendra in every admin view and vanishes from
 * Çagllavicë's, and the customer's tracking starts showing
 * "Porosia juaj po përpunohet nga Papirun Qendër!". Realtime pushes the
 * change to both panels and the customer instantly.
 */
export const forwardOrderToQender = async (order: Pick<OrderRecord, 'id' | 'notes'>) => {
  const notes = (order.notes ?? '').includes(FORWARDED_NOTES_MARKER)
    ? order.notes
    : `${order.notes ? `${order.notes}\n` : ''}${FORWARDED_NOTES_MARKER}`;
  const client = supabase as any;
  const { error } = await client.from(TABLE).update({ location_id: 'qender', notes }).eq('id', order.id);
  if (error) throw error;
};

/** Soft-delete: hide from active lists & user pill; keep record in Histori. */
export const softDeleteOrder = async (id: string) => {
  const client = supabase as any;
  const { error } = await client.from(TABLE).update({ is_visible: false }).eq('id', id);
  if (error) throw error;
};

export const restoreOrder = async (id: string) => {
  const client = supabase as any;
  const { error } = await client.from(TABLE).update({ is_visible: true }).eq('id', id);
  if (error) throw error;
};

export const hardDeleteOrder = async (id: string) => {
  const client = supabase as any;
  const { error } = await client.from(TABLE).delete().eq('id', id);
  if (error) throw error;
};

export const hardDeleteOrdersBatch = async (ids: string[]) => {
  if (ids.length === 0) return;
  const client = supabase as any;
  const { error } = await client.from(TABLE).delete().in('id', ids);
  if (error) throw error;
};

/** Archive every active order at midnight — moves them to history (invisible) */
export const archiveAllActiveOrders = async (): Promise<void> => {
  const client = supabase as any;
  const { error } = await client
    .from(TABLE)
    .update({ status: 'histori', is_visible: false })
    .in('status', ['pending', 'approved', 'preparing', 'out_for_delivery']);
  if (error) throw error;
};

/** Driver: update order status via RPC — bypasses RLS for PIN-authed drivers */
export const driverUpdateOrderStatus = async (id: string, status: OrderStatus): Promise<void> => {
  const client = supabase as any;
  const { error } = await client.rpc('driver_update_order_status', { p_order_id: id, p_status: status });
  if (error) throw error;
};

/** Driver: archive all active orders at midnight via RPC — bypasses RLS */
export const driverArchiveActiveOrders = async (): Promise<void> => {
  const client = supabase as any;
  const { error } = await client.rpc('driver_archive_active_orders');
  if (error) throw error;
};

/** Truncate — hard delete every order. For admin clean-slate button. */
export const hardDeleteAllOrders = async (): Promise<void> => {
  const client = supabase as any;
  // Delete in two passes: visible then hidden, to avoid RLS row limits
  const { error } = await client.from(TABLE).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
};

export const subscribeOrderRealtime = (id: string, onChange: (order: OrderRecord) => void) => {
  const channel = supabase
    .channel(`order-${id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLE, filter: `id=eq.${id}` },
      (payload) => {
        onChange(mapRow(payload.new as Row));
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeAllOrdersRealtime = (onChange: () => void) => {
  const channel = supabase
    .channel(`orders-live-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
};
