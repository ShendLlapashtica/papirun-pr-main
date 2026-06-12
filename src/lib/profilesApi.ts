import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  emri: string | null;
  mbiemri: string | null;
  numriTelefonit: string | null;
  vendbanimi: string | null;
  latitude: number | null;
  longitude: number | null;
}

type Row = {
  id: string;
  emri: string | null;
  mbiemri: string | null;
  numri_telefonit: string | null;
  vendbanimi: string | null;
  latitude: number | null;
  longitude: number | null;
};

const map = (r: Row): Profile => ({
  id: r.id,
  emri: r.emri,
  mbiemri: r.mbiemri,
  numriTelefonit: r.numri_telefonit,
  vendbanimi: r.vendbanimi,
  latitude: r.latitude !== null ? Number(r.latitude) : null,
  longitude: r.longitude !== null ? Number(r.longitude) : null,
});

export interface UpsertProfileInput {
  id: string;
  emri?: string | null;
  mbiemri?: string | null;
  numriTelefonit?: string | null;
  vendbanimi?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// Only fields explicitly provided are written, so a partial upsert can never
// null out columns an existing profile already has.
export const upsertProfile = async (input: UpsertProfileInput): Promise<void> => {
  const row: Record<string, unknown> = { id: input.id };
  if (input.emri !== undefined) row.emri = input.emri;
  if (input.mbiemri !== undefined) row.mbiemri = input.mbiemri;
  if (input.numriTelefonit !== undefined) row.numri_telefonit = input.numriTelefonit;
  if (input.vendbanimi !== undefined) row.vendbanimi = input.vendbanimi;
  if (input.latitude !== undefined) row.latitude = input.latitude;
  if (input.longitude !== undefined) row.longitude = input.longitude;
  const { error } = await supabase.from('profiles').upsert(row as never, { onConflict: 'id' });
  if (error) throw error;
};

export const fetchProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? map(data as Row) : null;
};
