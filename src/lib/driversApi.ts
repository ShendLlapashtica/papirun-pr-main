import { supabase } from '@/integrations/supabase/client';

export interface DeliveryDriver {
  id: string;
  name: string;
  phone: string;
  pin: string;
  isActive: boolean;
  createdAt: string;
}

type Row = {
  id: string;
  name: string;
  phone: string;
  pin: string;
  is_active: boolean;
  created_at: string;
};

const TABLE = 'delivery_drivers';

const mapRow = (row: Row): DeliveryDriver => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  pin: row.pin,
  isActive: row.is_active,
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

export const createDriver = async (name: string, phone: string, pin: string): Promise<DeliveryDriver> => {
  const client = supabase as any;
  const { data, error } = await client.from(TABLE).insert({ name, phone, pin }).select('*').single();
  if (error) throw error;
  return mapRow(data as Row);
};

export const updateDriver = async (id: string, updates: Partial<{ name: string; phone: string; pin: string; isActive: boolean }>) => {
  const client = supabase as any;
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.pin !== undefined) payload.pin = updates.pin;
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

/** Ensure default drivers (Delivery1-6 with Pass123.) exist — idempotent, migrates old PIN */
export const seedDefaultDrivers = async (): Promise<void> => {
  const client = supabase as any;
  const defaults = [
    { name: 'Delivery1', phone: '', pin: 'Pass123.', is_active: true },
    { name: 'Delivery2', phone: '', pin: 'Pass123.', is_active: true },
    { name: 'Delivery3', phone: '', pin: 'Pass123.', is_active: true },
    { name: 'Delivery4', phone: '', pin: 'Pass123.', is_active: true },
    { name: 'Delivery5', phone: '', pin: 'Pass123.', is_active: true },
    { name: 'Delivery6', phone: '', pin: 'Pass123.', is_active: true },
  ];
  for (const def of defaults) {
    const { data } = await client.from(TABLE).select('id, pin').eq('name', def.name).maybeSingle();
    if (!data) {
      await client.from(TABLE).insert(def);
    } else if (data.pin === 'Pass123') {
      await client.from(TABLE).update({ pin: 'Pass123.' }).eq('id', data.id);
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
