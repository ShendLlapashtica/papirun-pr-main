import { supabase } from '@/integrations/supabase/client';

export interface DeliveryDriver {
  id: string;
  name: string;
  username: string;
  phone: string;
  pin: string;
  role: string;
  isActive: boolean;
  isPaused: boolean;
  isPendingPause: boolean;   // requested pause, waiting for admin approval
  pausedAt: number | null;   // timestamp when pause started
  availableSince: number | null; // timestamp when became available (unpaused / app load)
  createdAt: string;
  lat: number | null;
  lng: number | null;
  color: string | null;
}

/** e.g. Adhurimi → "AD6", Endriti → "EN1" */
export function driverShortCode(driver: DeliveryDriver): string {
  const initials = driver.name.slice(0, 2).toUpperCase();
  const num = (driver.username || driver.phone).replace(/\D/g, '').slice(-1);
  return `${initials}${num}`;
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
  // lat/lng/color may not exist yet in production — treat as optional
  lat?: number | null;
  lng?: number | null;
  color?: string | null;
};

const TABLE = 'delivery_drivers';
const LOC_PREFIX = 'driver_loc_';
const PAUSE_PREFIX = 'driver_pause_';

// Default color palette — assigned round-robin when creating new drivers
export const DRIVER_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#eab308', // Yellow
  '#a855f7', // Purple
  '#f97316', // Orange
];

/** Restaurant / base location used for distance calculations and as map center */
export const RESTAURANT_COORDS = { lat: 42.6629, lng: 21.1655 };

/** Çagllavicë branch location */
export const CAGLLAVICE_COORDS = { lat: 42.618, lng: 21.077 };

/** Haversine great-circle distance in kilometres */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Phone → color lookup so colors work even without the color DB column
const PHONE_COLORS: Record<string, string> = {
  delivery1: DRIVER_COLORS[0],
  delivery2: DRIVER_COLORS[1],
  delivery3: DRIVER_COLORS[2],
  driver1: DRIVER_COLORS[0],
  driver2: DRIVER_COLORS[1],
  driver3: DRIVER_COLORS[2],
  driver4: DRIVER_COLORS[3],
  driver5: DRIVER_COLORS[4],
  driver6: DRIVER_COLORS[5],
};

function getDriverColor(row: Row, index = 0): string {
  if (row.color) return row.color;
  const phone = (row.phone || row.username || '').toLowerCase();
  return PHONE_COLORS[phone] ?? DRIVER_COLORS[index % DRIVER_COLORS.length];
}

// ── Location storage via storefront_settings ──────────────────────────────────
// We store each driver's GPS in the existing storefront_settings table
// (key = 'driver_loc_{id}', value_json = {lat, lng, t}) so we need no schema changes.

type LocMap = Record<string, { lat: number; lng: number }>;
interface PauseEntry {
  paused: boolean;
  pendingApproval?: boolean;
  pausedAt?: number;
  availableSince?: number;
}
type PauseMap = Record<string, PauseEntry>;

async function fetchLocMap(): Promise<LocMap> {
  const client = supabase as any;
  const { data, error } = await client
    .from('storefront_settings')
    .select('key, value_json')
    .like('key', `${LOC_PREFIX}%`);
  if (error || !data) return {};
  const map: LocMap = {};
  for (const row of data as { key: string; value_json: any }[]) {
    const id = row.key.replace(LOC_PREFIX, '');
    if (row.value_json?.lat != null) {
      map[id] = { lat: Number(row.value_json.lat), lng: Number(row.value_json.lng) };
    }
  }
  return map;
}

async function fetchPauseMap(): Promise<PauseMap> {
  const client = supabase as any;
  const { data, error } = await client
    .from('storefront_settings')
    .select('key, value_json')
    .like('key', `${PAUSE_PREFIX}%`);
  if (error || !data) return {};
  const map: PauseMap = {};
  for (const row of data as { key: string; value_json: any }[]) {
    const id = row.key.replace(PAUSE_PREFIX, '');
    const v = row.value_json ?? {};
    map[id] = {
      paused: Boolean(v.paused),
      pendingApproval: Boolean(v.pendingApproval),
      pausedAt: v.pausedAt ? Number(v.pausedAt) : undefined,
      availableSince: v.availableSince ? Number(v.availableSince) : undefined,
    };
  }
  return map;
}

// ── Row mapper ────────────────────────────────────────────────────────────────
const mapRow = (row: Row, locMap: LocMap = {}, pauseMap: PauseMap = {}, index = 0): DeliveryDriver => {
  const loc = locMap[row.id];
  const pause: PauseEntry = pauseMap[row.id] ?? { paused: false };
  return {
    id: row.id,
    name: row.name || row.display_name || row.username || 'Driver',
    username: row.username || row.phone || '',
    phone: row.phone || row.username || '',
    pin: row.pin || '',
    role: row.role || 'driver',
    isActive: row.is_active !== false,
    isPaused: Boolean(pause.paused),
    isPendingPause: Boolean(pause.pendingApproval),
    pausedAt: pause.pausedAt ?? null,
    availableSince: pause.availableSince ?? null,
    createdAt: row.created_at,
    lat: loc?.lat ?? (row.lat !== undefined && row.lat !== null ? Number(row.lat) : null),
    lng: loc?.lng ?? (row.lng !== undefined && row.lng !== null ? Number(row.lng) : null),
    color: getDriverColor(row, index),
  };
};

// ── CRUD ──────────────────────────────────────────────────────────────────────

export const fetchDrivers = async (): Promise<DeliveryDriver[]> => {
  const client = supabase as any;
  const [{ data, error }, locMap, pauseMap] = await Promise.all([
    client.from(TABLE).select('*').order('name'),
    fetchLocMap(),
    fetchPauseMap(),
  ]);
  if (error) throw error;
  return (data as Row[]).map((row, i) => mapRow(row, locMap, pauseMap, i));
};

export const fetchDriverById = async (id: string): Promise<DeliveryDriver | null> => {
  const client = supabase as any;
  const [{ data, error }, locMap, pauseMap] = await Promise.all([
    client.from(TABLE).select('*').eq('id', id).maybeSingle(),
    fetchLocMap(),
    fetchPauseMap(),
  ]);
  if (error) throw error;
  return data ? mapRow(data as Row, locMap, pauseMap) : null;
};

export const createDriver = async (
  name: string,
  phone: string,
  pin: string,
  username?: string,
  role: string = 'driver',
  color?: string
): Promise<DeliveryDriver> => {
  const client = supabase as any;
  const payload: Record<string, unknown> = {
    name,
    phone,
    pin,
    username: username || phone,
    role,
    is_active: true,
    password_hash: pin, // required NOT NULL in current schema
  };
  if (color) payload.color = color;
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
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.username !== undefined) payload.username = updates.username;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.pin !== undefined) payload.pin = updates.pin;
  if (updates.role !== undefined) payload.role = updates.role;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  const { error } = await client.from(TABLE).update(payload).eq('id', id);
  if (error) throw error;
};

const _upsertPause = async (id: string, entry: PauseEntry) => {
  const client = supabase as any;
  const { error } = await client
    .from('storefront_settings')
    .upsert(
      { key: `${PAUSE_PREFIX}${id}`, value_json: { ...entry, t: Date.now() } },
      { onConflict: 'key' }
    );
  if (error) throw error;
};

/** Driver: request pause — waits for admin approval */
export const requestDriverPause = async (id: string) => {
  await _upsertPause(id, { paused: false, pendingApproval: true });
};

/** Driver: go on pause immediately, no admin approval needed */
export const setDriverPause = async (id: string, paused: boolean) => {
  if (paused) {
    await _upsertPause(id, { paused: true, pendingApproval: false, pausedAt: Date.now() });
  } else {
    await _upsertPause(id, { paused: false, pendingApproval: false, availableSince: Date.now() });
  }
};

/** Admin: approve a pending pause request */
export const approvePause = async (id: string) => {
  await _upsertPause(id, { paused: true, pendingApproval: false, pausedAt: Date.now() });
};

/** Admin clean-slate: wipe all pause/wait state so every driver starts from 0s */
export const resetAllDriverTimers = async (): Promise<void> => {
  const client = supabase as any;
  const now = Date.now();
  // Set all drivers to available with availableSince = now
  const { data } = await client.from('delivery_drivers').select('id');
  if (!data) return;
  for (const row of data as { id: string }[]) {
    await client.from('storefront_settings').upsert(
      { key: `${PAUSE_PREFIX}${row.id}`, value_json: { paused: false, pendingApproval: false, availableSince: now, t: now } },
      { onConflict: 'key' }
    );
  }
};

/**
 * Update a driver's GPS position.
 * Location is stored in storefront_settings (key = driver_loc_{id}) so no
 * schema migration is required for the delivery_drivers table.
 */
export const updateDriverLocation = async (id: string, lat: number, lng: number) => {
  const client = supabase as any;
  const { error } = await client
    .from('storefront_settings')
    .upsert(
      { key: `${LOC_PREFIX}${id}`, value_json: { lat, lng, t: Date.now() } },
      { onConflict: 'key' }
    );
  if (error) throw error;
};

export const deleteDriver = async (id: string) => {
  const client = supabase as any;
  // Also remove their location entry
  await (client as any).from('storefront_settings').delete().eq('key', `${LOC_PREFIX}${id}`).catch(() => {});
  const { error } = await client.from(TABLE).delete().eq('id', id);
  if (error) throw error;
};

const PUSH_SUB_PREFIX = 'driver_push_sub_';

/** Save a driver's Web Push subscription to storefront_settings */
export const saveDriverPushSub = async (driverId: string, sub: PushSubscriptionJSON) => {
  const client = supabase as any;
  await client.from('storefront_settings').upsert(
    { key: `${PUSH_SUB_PREFIX}${driverId}`, value_json: sub },
    { onConflict: 'key' }
  );
};

/** Assign a driver to an order, record assignment timestamp, and send a push notification */
export const assignDriverToOrder = async (orderId: string, driverId: string) => {
  const client = supabase as any;
  const { error } = await client.from('orders').update({ assigned_driver_id: driverId }).eq('id', orderId);
  if (error) throw error;
  await client.from('storefront_settings').upsert(
    { key: `order_assign_${orderId}`, value_json: { at: Date.now(), driverId } },
    { onConflict: 'key' }
  );
  // Fire-and-forget push notification to the driver
  const { data: subRow } = await client
    .from('storefront_settings')
    .select('value_json')
    .eq('key', `${PUSH_SUB_PREFIX}${driverId}`)
    .maybeSingle();
  if (subRow?.value_json) {
    fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subRow.value_json,
        title: 'Porosi e re!',
        body: 'Ke nje porosi te re.',
        orderId,
      }),
    }).catch(() => {});
  }
};

/** Fetch assignment timestamps for a batch of orders. Returns map orderId → ms timestamp. */
export const fetchOrderAssignTimes = async (orderIds: string[]): Promise<Record<string, number>> => {
  if (!orderIds.length) return {};
  const client = supabase as any;
  const keys = orderIds.map(id => `order_assign_${id}`);
  const { data } = await client.from('storefront_settings').select('key, value_json').in('key', keys);
  const map: Record<string, number> = {};
  for (const row of (data ?? []) as { key: string; value_json: any }[]) {
    const id = row.key.replace('order_assign_', '');
    if (row.value_json?.at) map[id] = Number(row.value_json.at);
  }
  return map;
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

/** Ensure all 6 default drivers exist — idempotent. */
export const seedDefaultDrivers = async (): Promise<void> => {
  const client = supabase as any;
  const defaults = [
    { name: 'Driver 1', username: 'driver1', display_name: 'Driver 1', phone: 'driver1', pin: '123', role: 'driver', is_active: true, password_hash: '123' },
    { name: 'Driver 2', username: 'driver2', display_name: 'Driver 2', phone: 'driver2', pin: '123', role: 'driver', is_active: true, password_hash: '123' },
    { name: 'Driver 3', username: 'driver3', display_name: 'Driver 3', phone: 'driver3', pin: '123', role: 'driver', is_active: true, password_hash: '123' },
    { name: 'Driver 4', username: 'driver4', display_name: 'Driver 4', phone: 'driver4', pin: '123', role: 'driver', is_active: true, password_hash: '123' },
    { name: 'Driver 5', username: 'driver5', display_name: 'Driver 5', phone: 'driver5', pin: '123', role: 'driver', is_active: true, password_hash: '123' },
    { name: 'Driver 6', username: 'driver6', display_name: 'Driver 6', phone: 'driver6', pin: '123', role: 'driver', is_active: true, password_hash: '123' },
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
    .channel(`driver-orders-${driverId}`)
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
  return () => { supabase.removeChannel(channel); };
};

/**
 * Subscribe to real-time driver location updates.
 * Watches storefront_settings for driver_loc_* key changes.
 */
export const subscribeAllDriverLocations = (onChange: () => void) => {
  const channel = supabase
    .channel(`driver-locs-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'storefront_settings' },
      (payload: any) => {
        const key: string = payload?.new?.key || payload?.old?.key || '';
        if (key.startsWith(LOC_PREFIX)) onChange();
      }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};
