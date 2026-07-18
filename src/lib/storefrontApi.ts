import { supabase } from '@/integrations/supabase/client';
import type { OfferItem } from '@/data/menuData';
import type { SiteTextOverrides } from '@/lib/siteTexts';
import { compressImage } from '@/lib/imageUtils';

const STOREFRONT_OFFERS_TABLE = 'storefront_offers';
const STOREFRONT_SETTINGS_TABLE = 'storefront_settings';
const PRODUCT_IMAGE_BUCKET = 'product-images';

const LEGACY_OFFERS_SECTION_KEY = 'papirun_oferta_ramazani';
const LEGACY_SITE_TEXTS_KEY = 'papirun_site_texts';

export const OFFERS_SECTION_ENABLED_KEY = 'offers_section_enabled';
export const SITE_TEXTS_SETTING_KEY = 'site_texts';
export const OFFER_BADGE_TEXT_KEY = 'offer_badge_text';
export const WHATSAPP_FALLBACK_KEY = 'whatsapp_fallback_enabled';
export const DEFAULT_OFFER_BADGE_TEXT = 'Vetëm në pikën Papirun Çagllavicë';
export const CATEGORY_ORDER_KEY = 'category_order';
export const DEFAULT_CATEGORY_ORDER: string[] = ['salad', 'fajita', 'sandwich', 'sides', 'drink'];

// Product ids not stocked at the Çagllavicë branch. Stored as a settings row
// instead of a products.* column so it works without a DB migration.
export const CAGLLAVICE_UNAVAILABLE_KEY = 'cagllavice_unavailable_ids';
export const DEFAULT_CAGLLAVICE_UNAVAILABLE: string[] = [];

// Temporary "ignore business hours" override — lets an admin place/accept
// test orders outside normal hours without it staying on by accident.
export const ORDERS_FORCE_OPEN_KEY = 'orders_force_open';
export const DEFAULT_ORDERS_FORCE_OPEN = false;

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
  image_urls: string[];
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

const readLegacyOffersSectionEnabled = (): boolean | null => {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(LEGACY_OFFERS_SECTION_KEY);
  if (raw === null) return null;
  return raw !== 'false';
};

const readLegacySiteTexts = (): SiteTextOverrides | null =>
  readLegacyJson<SiteTextOverrides>(LEGACY_SITE_TEXTS_KEY);

const mapRowToOffer = (row: StorefrontOfferRow): StorefrontOffer => {
  const images = row.image_urls?.length ? row.image_urls : (row.image_url ? [row.image_url] : []);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    image: images[0] ?? '',
    images,
    includes: row.includes ?? [],
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
};

const mapOfferToRow = (offer: OfferItem | StorefrontOffer, fallbackSortOrder = 0) => {
  const images = offer.images?.length ? offer.images : (offer.image ? [offer.image] : []);
  return {
    id: offer.id,
    title: offer.title,
    description: offer.description,
    price: offer.price,
    image_url: images[0] ?? offer.image ?? '',
    image_urls: images,
    includes: offer.includes ?? [],
    is_active: 'isActive' in offer ? offer.isActive : true,
    sort_order: 'sortOrder' in offer ? offer.sortOrder : fallbackSortOrder,
  };
};

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

export const upsertStorefrontOffer = async (
  offer: OfferItem | StorefrontOffer,
  fallbackSortOrder = 0,
) => {
  const client = supabase as any;
  const payload = mapOfferToRow(offer, fallbackSortOrder);

  const run = (p: typeof payload) =>
    client.from(STOREFRONT_OFFERS_TABLE).upsert(p, { onConflict: 'id' }).select('*').single();

  let { data, error } = await run(payload);

  if (error?.code === '42703' && 'image_urls' in payload) {
    const { image_urls: _removed, ...payloadWithout } = payload;
    ({ data, error } = await run(payloadWithout as typeof payload));
  }

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
  if (Array.isArray(updates.images)) {
    payload.image_urls = updates.images;
    if (!('image' in updates)) payload.image_url = updates.images[0] ?? '';
  }
  if (Array.isArray(updates.includes)) payload.includes = updates.includes;
  if (typeof updates.isActive === 'boolean') payload.is_active = updates.isActive;
  if (typeof updates.sortOrder === 'number') payload.sort_order = updates.sortOrder;

  const run = (p: Record<string, unknown>) =>
    client.from(STOREFRONT_OFFERS_TABLE).update(p).eq('id', id).select('*').single();

  let { data, error } = await run(payload);

  // If image_urls column doesn't exist yet (migration pending), retry without it
  if (error?.code === '42703' && 'image_urls' in payload) {
    const { image_urls: _removed, ...payloadWithout } = payload;
    ({ data, error } = await run(payloadWithout));
  }

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
    .channel(`storefront-offers-live-${Math.random().toString(36).slice(2)}`)
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
    .channel(`storefront-settings-live-${Math.random().toString(36).slice(2)}`)
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

const deleteImageByUrl = async (imageUrl: string): Promise<void> => {
  if (!imageUrl) return;
  const marker = `/${PRODUCT_IMAGE_BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return;
  const path = decodeURIComponent(imageUrl.slice(idx + marker.length).split('?')[0]);
  await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
};

export const uploadStorefrontOfferImage = async (file: File, offerId: string, oldImageUrl?: string) => {
  if (oldImageUrl) await deleteImageByUrl(oldImageUrl);

  const processed = await compressImage(file);
  const path = `${offerId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, processed, { upsert: false, contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export const addStorefrontOfferImage = async (file: File, offerId: string): Promise<string> => {
  const processed = await compressImage(file);
  const path = `${offerId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, processed, { upsert: false, contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export const removeStorefrontOfferImage = async (imageUrl: string): Promise<void> => {
  await deleteImageByUrl(imageUrl);
};