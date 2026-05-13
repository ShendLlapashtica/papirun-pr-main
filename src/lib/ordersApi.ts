import { supabase } from '@/integrations/supabase/client';
import type { CartItem } from '@/types/menu';

export type OrderStatus = 'pending' | 'approved' | 'preparing' | 'out_for_delivery' | 'rejected' | 'completed' | 'histori';
export type OrderSource = 'web' | 'app';

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
  prepEtaMinutes: number | null;
  isVisible: boolean;
  assignedDriverId?: string | null;
  driverRating?: number | null;
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
  prepEtaMinutes: row.prep_eta_minutes,
  isVisible: row.is_visible !== false,
  assignedDriverId: row.assigned_driver_id,
  driverRating: row.driver_rating,
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
  const client = supabase as any;
  const payload = {
    user_id: input.userId ?? null,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    delivery_address: input.deliveryAddress,
    delivery_lat: input.deliveryLat,
    delivery_lng: input.deliveryLng,
    location_id: input.locationId ?? null,
    items: input.items,
    subtotal: input.subtotal,
    delivery_fee: input.deliveryFee ?? 0,
    total: input.total,
    notes: input.notes ?? '',
    status: 'pending',
    source: input.source ?? detectOrderSource(),
  };
  const { data, error } = await client.from(TABLE).insert(payload).select('*').single();
  if (error) throw error;
  return mapRow(data as Row);
};

export const fetchOrder = async (id: string): Promise<OrderRecord | null> => {
  const client = supabase as any;
  const { data, error } = await client.from(TABLE).select('*').eq('id', id).maybeSingle();
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
