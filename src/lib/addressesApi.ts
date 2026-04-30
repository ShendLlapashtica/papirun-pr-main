import { supabase } from '@/integrations/supabase/client';

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
  createdAt: string;
}

type Row = {
  id: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
};

const map = (r: Row): SavedAddress => ({
  id: r.id,
  label: r.label,
  address: r.address,
  lat: r.lat !== null ? Number(r.lat) : null,
  lng: r.lng !== null ? Number(r.lng) : null,
  isDefault: r.is_default,
  createdAt: r.created_at,
});

export const fetchAddresses = async (userId: string): Promise<SavedAddress[]> => {
  const client = supabase as any;
  const { data, error } = await client
    .from('user_addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(map);
};

export interface SaveAddressInput {
  userId: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  isDefault?: boolean;
}

export const saveAddress = async (input: SaveAddressInput): Promise<SavedAddress> => {
  const client = supabase as any;
  // If marking default, unset other defaults
  if (input.isDefault) {
    await client.from('user_addresses').update({ is_default: false }).eq('user_id', input.userId);
  }
  const { data, error } = await client
    .from('user_addresses')
    .insert({
      user_id: input.userId,
      label: input.label,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      is_default: input.isDefault ?? false,
    })
    .select('*')
    .single();
  if (error) throw error;
  return map(data as Row);
};

export const deleteAddress = async (id: string) => {
  const client = supabase as any;
  const { error } = await client.from('user_addresses').delete().eq('id', id);
  if (error) throw error;
};

export const setDefaultAddress = async (userId: string, id: string) => {
  const client = supabase as any;
  await client.from('user_addresses').update({ is_default: false }).eq('user_id', userId);
  const { error } = await client.from('user_addresses').update({ is_default: true }).eq('id', id);
  if (error) throw error;
};
