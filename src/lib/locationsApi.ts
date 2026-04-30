import { supabase } from '@/integrations/supabase/client';

export interface StorefrontLocation {
  id: string;
  nameSq: string;
  nameEn: string;
  hoursSq: string;
  hoursEn: string;
  openDays: number[];
  openMinute: number;
  closeMinute: number;
  lat: number;
  lng: number;
  addressSq: string;
  addressEn: string;
  whatsappPhone: string;
  isActive: boolean;
  sortOrder: number;
}

type Row = {
  id: string;
  name_sq: string;
  name_en: string;
  hours_sq: string;
  hours_en: string;
  open_days: number[];
  open_minute: number;
  close_minute: number;
  lat: number;
  lng: number;
  address_sq: string;
  address_en: string;
  whatsapp_phone: string;
  is_active: boolean;
  sort_order: number;
};

const TABLE = 'storefront_locations';

const mapRow = (row: Row): StorefrontLocation => ({
  id: row.id,
  nameSq: row.name_sq,
  nameEn: row.name_en,
  hoursSq: row.hours_sq,
  hoursEn: row.hours_en,
  openDays: row.open_days ?? [],
  openMinute: row.open_minute,
  closeMinute: row.close_minute,
  lat: Number(row.lat),
  lng: Number(row.lng),
  addressSq: row.address_sq,
  addressEn: row.address_en,
  whatsappPhone: row.whatsapp_phone,
  isActive: row.is_active,
  sortOrder: row.sort_order,
});

const mapToRow = (loc: StorefrontLocation) => ({
  id: loc.id,
  name_sq: loc.nameSq,
  name_en: loc.nameEn,
  hours_sq: loc.hoursSq,
  hours_en: loc.hoursEn,
  open_days: loc.openDays,
  open_minute: loc.openMinute,
  close_minute: loc.closeMinute,
  lat: loc.lat,
  lng: loc.lng,
  address_sq: loc.addressSq,
  address_en: loc.addressEn,
  whatsapp_phone: loc.whatsappPhone,
  is_active: loc.isActive,
  sort_order: loc.sortOrder,
});

export const fetchLocations = async (): Promise<StorefrontLocation[]> => {
  const client = supabase as any;
  const { data, error } = await client.from(TABLE).select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(mapRow);
};

export const upsertLocation = async (loc: StorefrontLocation) => {
  const client = supabase as any;
  const { error } = await client.from(TABLE).upsert(mapToRow(loc), { onConflict: 'id' });
  if (error) throw error;
};

export const updateLocation = async (id: string, updates: Partial<StorefrontLocation>) => {
  const client = supabase as any;
  const payload: Record<string, unknown> = {};
  if (updates.nameSq !== undefined) payload.name_sq = updates.nameSq;
  if (updates.nameEn !== undefined) payload.name_en = updates.nameEn;
  if (updates.hoursSq !== undefined) payload.hours_sq = updates.hoursSq;
  if (updates.hoursEn !== undefined) payload.hours_en = updates.hoursEn;
  if (updates.openDays !== undefined) payload.open_days = updates.openDays;
  if (updates.openMinute !== undefined) payload.open_minute = updates.openMinute;
  if (updates.closeMinute !== undefined) payload.close_minute = updates.closeMinute;
  if (updates.lat !== undefined) payload.lat = updates.lat;
  if (updates.lng !== undefined) payload.lng = updates.lng;
  if (updates.addressSq !== undefined) payload.address_sq = updates.addressSq;
  if (updates.addressEn !== undefined) payload.address_en = updates.addressEn;
  if (updates.whatsappPhone !== undefined) payload.whatsapp_phone = updates.whatsappPhone;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
  const { error } = await client.from(TABLE).update(payload).eq('id', id);
  if (error) throw error;
};

export const deleteLocation = async (id: string) => {
  const client = supabase as any;
  const { error } = await client.from(TABLE).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeLocationsRealtime = (onChange: () => void) => {
  const channel = supabase
    .channel('storefront-locations-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};

export const isLocationOpenNow = (loc: StorefrontLocation): boolean => {
  const now = new Date();
  const day = now.getDay();
  if (!loc.openDays.includes(day)) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= loc.openMinute && minutes < loc.closeMinute;
};

const fmtTime = (mins: number) => {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

/**
 * Returns a friendly status string for a location based on the current time.
 * SQ: "Hapur tani · deri në 19:00" / "Mbyllur · Hapet sot në 14:00" / "Mbyllur · Hapet nesër në 07:00"
 * EN: "Open now · until 19:00" / "Closed · Opens today at 14:00" / "Closed · Opens tomorrow at 07:00"
 */
export const formatNextOpenStatus = (loc: StorefrontLocation, lang: 'sq' | 'en'): string => {
  const now = new Date();
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const isOpenToday = loc.openDays.includes(day);

  if (isOpenToday && minutes >= loc.openMinute && minutes < loc.closeMinute) {
    return lang === 'sq'
      ? `Hapur tani · deri në ${fmtTime(loc.closeMinute)}`
      : `Open now · until ${fmtTime(loc.closeMinute)}`;
  }

  // Closed: figure out next open day/time
  if (isOpenToday && minutes < loc.openMinute) {
    return lang === 'sq'
      ? `Mbyllur · Hapet sot në ${fmtTime(loc.openMinute)}`
      : `Closed · Opens today at ${fmtTime(loc.openMinute)}`;
  }

  // Find next day in openDays (within 7 days)
  for (let i = 1; i <= 7; i++) {
    const nextDay = (day + i) % 7;
    if (loc.openDays.includes(nextDay)) {
      if (i === 1) {
        return lang === 'sq'
          ? `Mbyllur · Hapet nesër në ${fmtTime(loc.openMinute)}`
          : `Closed · Opens tomorrow at ${fmtTime(loc.openMinute)}`;
      }
      const dayNamesSq = ['Diel', 'Hënë', 'Martë', 'Mërkurë', 'Enjte', 'Premte', 'Shtunë'];
      const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const name = lang === 'sq' ? dayNamesSq[nextDay] : dayNamesEn[nextDay];
      return lang === 'sq'
        ? `Mbyllur · Hapet të ${name} në ${fmtTime(loc.openMinute)}`
        : `Closed · Opens ${name} at ${fmtTime(loc.openMinute)}`;
    }
  }

  return lang === 'sq' ? 'Mbyllur' : 'Closed';
};
