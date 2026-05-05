import { supabase } from '@/integrations/supabase/client';

export interface DeliveryDriver {
  id: string;
  name: string;
  username: string;
  phone: string;
  pin: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

type Row = {
  id: string;
  name?: string | null;
  username?: string | null;
  display_name?: string | null;
  phone?: string | null;
  pin?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  created_at: string;
};

const TABLE = 'delivery_drivers';

const mapRow = (row: Row): DeliveryDriver => ({
  id: row.id,
  name: row.name || row.display_name || row.username || 'Driver',
  username: row.username || row.phone || '',
  phone: row.phone || row.username || '',
  pin: row.pin || '',
  role: row.role || 'driver',
  isActive: row.is_active !== false,
  createdAt: row.created_at,
});

export const fetchDrivers = async (): Promise<DeliveryDriver[]> => {
  const client = supabase as any;
  const { data, error } = await client.from(TABLE).select('*').order('name');
  if (error) throw error;
  return (data as Row[]).map(mapRow);
};

export const fetchDriverById = async (id: string): Promise<DeliveryDriver | null> => {
  const client = supabase as any;
  const { data, error } = await client.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Row) : null;
};

export const createDriver = async (
  name: string,
  phone: string,
  pin: string,
  username?: string,
  role: string = 'driver'
): Promise<DeliveryDriver> => {
  const client = supabase as any;
  const payload: Record<string, unknown> = {
    name,
    phone,
    pin,
    username: username || phone,
    role,
    is_active: true,
  };
  const { data, error } = await client.from(TABLE).insert(payload).select('*').single();
  if (error) throw error;
  return mapRow(data as Row);
};

export const updateDriver = async (
  id: string,
  updates: Partial<{ name: string; username: string; phone: string; pin: string; role: string; isActive: boolean }>
) => {
  const client = supabase as any;
  const payload: Record<string, unknown> = {};
  if (updates.name     !== undefined) payload.name      = updates.name;
  if (updates.username !== undefined) payload.username  = updates.username;
  if (updates.phone    !== undefined) payload.phone     = updates.phone;
  if (updates.pin      !== undefined) payload.pin       = updates.pin;
  if (updates.role     !== undefined) payload.role      = updates.role;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  const { error } = await client.from(TABLE).update(payload).eq('id', id);
  if (error) throw error;
};

export const deleteDriver = async (id: string) => {
  const client = supabase as any;
  const { error } = await client.from(TABLE).delete().eq('id', id);
  if (error) throw error;
};

/** Assign a driver to an order */
export const assignDriverToOrder = async (orderId: string, driverId: string) => {
  const client = supabase as any;
  const { error } = await client.from('orders').update({ assigned_driver_id: driverId }).eq('id', orderId);
  if (error) throw error;
};

/** Rate a driver for a specific order (1-5) */
export const rateDriver = async (orderId: string, rating: number, note?: string) => {
  if (rating < 1 || rating > 5) throw new Error('Rating must be 1-5');
  const client = supabase as any;
  const payload: any = { driver_rating: rating };
  if (note) payload.driver_rating_note = note;
  const { error } = await client.from('orders').update(payload).eq('id', orderId);
  if (error) throw error;
};

/** Fetch orders assigned to a specific driver */
export const fetchDriverOrders = async (driverId: string) => {
  const client = supabase as any;
  const { data, error } = await client
    .from('orders')
    .select('*')
    .eq('assigned_driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
};

/** Ensure default drivers (Driver 1-6) exist — idempotent upsert via phone. */
export const seedDefaultDrivers = async (): Promise<void> => {
  const client = supabase as any;
  const defaults = [
    { name: 'Driver 1', username: 'driver1', display_name: 'Driver 1', phone: 'driver1', pin: '123', role: 'driver', is_active: true },
    { name: 'Driver 2', username: 'driver2', display_name: 'Driver 2', phone: 'driver2', pin: '123', role: 'driver', is_active: true },
    { name: 'Driver 3', username: 'driver3', display_name: 'Driver 3', phone: 'driver3', pin: '123', role: 'driver', is_active: true },
    { name: 'Driver 4', username: 'driver4', display_name: 'Driver 4', phone: 'driver4', pin: '123', role: 'driver', is_active: true },
    { name: 'Driver 5', username: 'driver5', display_name: 'Driver 5', phone: 'driver5', pin: '123', role: 'driver', is_active: true },
    { name: 'Driver 6', username: 'driver6', display_name: 'Driver 6', phone: 'driver6', pin: '123', role: 'driver', is_active: true },
  ];
  for (const def of defaults) {
    const { data } = await client.from(TABLE).select('id').eq('phone', def.phone).maybeSingle();
    if (!data) {
      const { error } = await client.from(TABLE).insert(def);
      if (error) console.error(`[seedDrivers] insert failed for ${def.name}:`, error.message);
    }
  }
};

export const subscribeDriverOrdersRealtime = (driverId: string, onChange: () => void) => {
  const channel = supabase
    .channel(`driver-orders-${driverId}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `assigned_driver_id=eq.${driverId}`,
      },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
};
