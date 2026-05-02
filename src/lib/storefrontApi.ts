import { supabase } from '@/integrations/supabase/client';
import type { OfferItem } from '@/data/menuData';
import type { SiteTextOverrides } from '@/lib/siteTexts';

const STOREFRONT_OFFERS_TABLE = 'storefront_offers';
const STOREFRONT_SETTINGS_TABLE = 'storefront_settings';
const PRODUCT_IMAGE_BUCKET = 'product-images';

const LEGACY_OFFERS_KEY = 'papirun_offers_data';
const LEGACY_OFFERS_SECTION_KEY = 'papirun_oferta_ramazani';
const LEGACY_SITE_TEXTS_KEY = 'papirun_site_texts';

export const OFFERS_SECTION_ENABLED_KEY = 'offers_section_enabled';
export const SITE_TEXTS_SETTING_KEY = 'site_texts';

export interface StorefrontOffer extends OfferItem {
  isActive: boolean;
  sortOrder: number;
}

type StorefrontOfferRow = {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url: string;
  includes: string[];
  is_active: boolean;
  sort_order: number;
};

type StorefrontSettingRow = {
  key: string;
  value_json: unknown;
};

const isBrowser = () => typeof window !== 'undefined';

const readLegacyJson = <T>(key: string): T | null => {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const readLegacyOffers = (): OfferItem[] | null => readLegacyJson<OfferItem[]>(LEGACY_OFFERS_KEY);

const readLegacyOffersSectionEnabled = (): boolean | null => {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(LEGACY_OFFERS_SECTION_KEY);
  if (raw === null) return null;
  return raw !== 'false';
};

const readLegacySiteTexts = (): SiteTextOverrides | null =>
  readLegacyJson<SiteTextOverrides>(LEGACY_SITE_TEXTS_KEY);

const normalizeOffer = (offer: OfferItem, index = 0): StorefrontOffer => ({
  ...offer,
  isActive: true,
  sortOrder: index,
});

const mapRowToOffer = (row: StorefrontOfferRow): StorefrontOffer => ({
  id: row.id,
  title: row.title,
  description: row.description,
  price: Number(row.price),
  image: row.image_url,
  includes: row.includes ?? [],
  isActive: row.is_active,
  sortOrder: row.sort_order,
});

const mapOfferToRow = (offer: OfferItem | StorefrontOffer, fallbackSortOrder = 0) => ({
  id: offer.id,
  title: offer.title,
  description: offer.description,
  price: offer.price,
  image_url: offer.image,
  includes: offer.includes ?? [],
  is_active: 'isActive' in offer ? offer.isActive : true,
  sort_order: 'sortOrder' in offer ? offer.sortOrder : fallbackSortOrder,
});

export const fetchStorefrontOffers = async (): Promise<StorefrontOffer[]> => {
  const client = supabase as any;
  const { data, error } = await client
    .from(STOREFRONT_OFFERS_TABLE)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as StorefrontOfferRow[]).map(mapRowToOffer);
};

export const ensureSeedStorefrontOffers = async (fallbackOffers: OfferItem[]) => {
  const client = supabase as any;
  const { count, error: countError } = await client
    .from(STOREFRONT_OFFERS_TABLE)
    .select('*', { count: 'exact', head: true });

  if (countError) throw countError;
  if ((count ?? 0) > 0) return;

  const sourceOffers = readLegacyOffers() ?? fallbackOffers;
  const payload = sourceOffers.map((offer, index) =>
    mapOfferToRow(normalizeOffer(offer, index), index)
  );

  const { error } = await client
    .from(STOREFRONT_OFFERS_TABLE)
    .upsert(payload, { onConflict: 'id' });

  if (error) throw error;
};

export const upsertStorefrontOffer = async (
  offer: OfferItem | StorefrontOffer,
  fallbackSortOrder = 0,
) => {
  const client = supabase as any;
  const payload = mapOfferToRow(offer, fallbackSortOrder);
  const { data, error } = await client
    .from(STOREFRONT_OFFERS_TABLE)
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;
  return mapRowToOffer(data as StorefrontOfferRow);
};

export const handleUpdateStorefrontOffer = async (
  id: string,
  updates: Partial<StorefrontOffer>,
) => {
  const client = supabase as any;
  const payload: Record<string, unknown> = {};

  if (typeof updates.title === 'string') payload.title = updates.title;
  if (typeof updates.description === 'string') payload.description = updates.description;
  if (typeof updates.price === 'number') payload.price = updates.price;
  if (typeof updates.image === 'string') payload.image_url = updates.image;
  if (Array.isArray(updates.includes)) payload.includes = updates.includes;
  if (typeof updates.isActive === 'boolean') payload.is_active = updates.isActive;
  if (typeof updates.sortOrder === 'number') payload.sort_order = updates.sortOrder;

  const { data, error } = await client
    .from(STOREFRONT_OFFERS_TABLE)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return mapRowToOffer(data as StorefrontOfferRow);
};

export const deleteStorefrontOffer = async (id: string) => {
  const client = supabase as any;
  const { error } = await client.from(STOREFRONT_OFFERS_TABLE).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeStorefrontOffersRealtime = (onChange: () => void) => {
  const channel = supabase
    .channel('storefront-offers-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: STOREFRONT_OFFERS_TABLE },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const fetchStorefrontSetting = async <T>(
  key: string,
  fallback: T,
): Promise<T> => {
  const client = supabase as any;
  const { data, error } = await client
    .from(STOREFRONT_SETTINGS_TABLE)
    .select('key, value_json')
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  if (!data) return fallback;

  return ((data as StorefrontSettingRow).value_json ?? fallback) as T;
};

export const ensureStorefrontSetting = async <T>(key: string, fallback: T): Promise<T> => {
  const client = supabase as any;
  const { data, error } = await client
    .from(STOREFRONT_SETTINGS_TABLE)
    .select('key, value_json')
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  if (data) return ((data as StorefrontSettingRow).value_json ?? fallback) as T;

  let initialValue: T = fallback;
  if (key === OFFERS_SECTION_ENABLED_KEY) {
    initialValue = (readLegacyOffersSectionEnabled() ?? fallback) as T;
  }
  if (key === SITE_TEXTS_SETTING_KEY) {
    initialValue = (readLegacySiteTexts() ?? fallback) as T;
  }

  await upsertStorefrontSetting(key, initialValue);
  return initialValue;
};

export const upsertStorefrontSetting = async <T>(key: string, value: T) => {
  const client = supabase as any;
  const { data, error } = await client
    .from(STOREFRONT_SETTINGS_TABLE)
    .upsert({ key, value_json: value }, { onConflict: 'key' })
    .select('key, value_json')
    .single();

  if (error) throw error;
  return ((data as StorefrontSettingRow).value_json ?? value) as T;
};

export const subscribeStorefrontSettingsRealtime = (onChange: () => void) => {
  const channel = supabase
    .channel('storefront-settings-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: STOREFRONT_SETTINGS_TABLE },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const uploadStorefrontOfferImage = async (file: File, offerId: string) => {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `offers/${offerId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw error;

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};