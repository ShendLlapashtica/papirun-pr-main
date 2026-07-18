import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { MenuItem } from '@/types/menu';
import type { MenuExtra } from '@/types/menuExtra';
import { compressImage } from '@/lib/imageUtils';
export {
  OFFERS_SECTION_ENABLED_KEY,
  OFFER_BADGE_TEXT_KEY,
  DEFAULT_OFFER_BADGE_TEXT,
  SITE_TEXTS_SETTING_KEY,
  WHATSAPP_FALLBACK_KEY,
  CATEGORY_ORDER_KEY,
  DEFAULT_CATEGORY_ORDER,
  CAGLLAVICE_UNAVAILABLE_KEY,
  DEFAULT_CAGLLAVICE_UNAVAILABLE,
  ORDERS_FORCE_OPEN_KEY,
  DEFAULT_ORDERS_FORCE_OPEN,
  type StorefrontOffer,
  deleteStorefrontOffer,
  ensureStorefrontSetting,
  fetchStorefrontOffers,
  fetchStorefrontSetting,
  handleUpdateStorefrontOffer,
  subscribeStorefrontOffersRealtime,
  subscribeStorefrontSettingsRealtime,
  upsertStorefrontOffer,
  upsertStorefrontSetting,
  uploadStorefrontOfferImage,
  addStorefrontOfferImage,
  removeStorefrontOfferImage,
} from '@/lib/storefrontApi';

const PRODUCTS_TABLE = 'products';
const MENU_EXTRAS_TABLE = 'menu_extras';
const PRODUCT_IMAGE_BUCKET = 'product-images';

// Signals to other open tabs that products changed — they listen via the storage event.
const notifyProductMutation = () => {
  try { localStorage.setItem('papirun_products_mutated', Date.now().toString()); } catch { /* quota */ }
};

type ProductRow = {
  id: string;
  name_sq: string;
  name_en: string;
  description_sq: string;
  description_en: string;
  price: number;
  image_url: string;
  category: string;
  ingredients: string[];
  extras: string[];
  crunch_level: number;
  likes: number;
  rating: number;
  review_count: number;
  is_available: boolean;
};

type MenuExtraRow = {
  id: string;
  name_sq: string;
  name_en: string;
  price: number;
  is_active: boolean;
  sort_order: number;
};

const mapRowToMenuItem = (row: ProductRow): MenuItem => ({
  id: row.id,
  name: { sq: row.name_sq, en: row.name_en },
  description: { sq: row.description_sq, en: row.description_en },
  price: Number(row.price),
  image: row.image_url,
  category: row.category as MenuItem['category'],
  ingredients: row.ingredients ?? [],
  extras: row.extras ?? [],
  crunchLevel: row.crunch_level,
  likes: row.likes,
  rating: Number(row.rating),
  reviewCount: row.review_count,
  isAvailable: row.is_available,
  // Real value is merged in from the cagllavice_unavailable_ids storefront
  // setting by useLiveMenuItems — there is no DB column for this (see
  // CAGLLAVICE_UNAVAILABLE_KEY). Default true so any direct caller of this
  // mapper still gets a valid MenuItem.
  isAvailableOnCagllavice: true,
});

const mapMenuExtraRow = (row: MenuExtraRow): MenuExtra => ({
  id: row.id,
  name: { sq: row.name_sq, en: row.name_en },
  price: Number(row.price),
  isActive: row.is_active,
  sortOrder: row.sort_order,
});

const mapMenuItemToInsert = (item: MenuItem): TablesInsert<'products'> => ({
  id: item.id,
  name_sq: item.name.sq,
  name_en: item.name.en,
  description_sq: item.description.sq,
  description_en: item.description.en,
  price: item.price,
  image_url: item.image,
  category: item.category,
  ingredients: item.ingredients,
  extras: item.extras,
  crunch_level: item.crunchLevel,
  is_available: item.isAvailable,
});

const mapMenuItemPatchToUpdate = (updates: Partial<MenuItem>): TablesUpdate<'products'> => {
  const payload: TablesUpdate<'products'> = {};

  if (updates.name) {
    payload.name_sq = updates.name.sq;
    payload.name_en = updates.name.en;
  }

  if (updates.description) {
    payload.description_sq = updates.description.sq;
    payload.description_en = updates.description.en;
  }

  if (typeof updates.price === 'number') payload.price = updates.price;
  if (typeof updates.image === 'string') payload.image_url = updates.image;
  if (updates.category) payload.category = updates.category;
  if (updates.ingredients) payload.ingredients = updates.ingredients;
  if (updates.extras) payload.extras = updates.extras;
  if (typeof updates.crunchLevel === 'number') payload.crunch_level = updates.crunchLevel;
  if (typeof updates.isAvailable === 'boolean') payload.is_available = updates.isAvailable;
  // isAvailableOnCagllavice is intentionally not persisted here — it lives in
  // the cagllavice_unavailable_ids storefront setting, not a products column.

  return payload;
};

export const fetchProducts = async (): Promise<MenuItem[]> => {
  const { data, error } = await supabase
    .from(PRODUCTS_TABLE)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as ProductRow[]).map(mapRowToMenuItem);
};

export const fetchProductById = async (id: string): Promise<MenuItem | null> => {
  const { data, error } = await supabase
    .from(PRODUCTS_TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRowToMenuItem(data as ProductRow) : null;
};

// Only the fields that actually differ between two snapshots of the same product —
// used so Admin saves can never write back a field the user never touched.
export const diffMenuItem = (before: MenuItem, after: MenuItem): Partial<MenuItem> => {
  const patch: Partial<MenuItem> = {};
  if (after.name.sq !== before.name.sq || after.name.en !== before.name.en) patch.name = after.name;
  if (after.description.sq !== before.description.sq || after.description.en !== before.description.en) patch.description = after.description;
  if (after.price !== before.price) patch.price = after.price;
  if (after.image !== before.image) patch.image = after.image;
  if (after.category !== before.category) patch.category = after.category;
  if (JSON.stringify(after.ingredients) !== JSON.stringify(before.ingredients)) patch.ingredients = after.ingredients;
  if (JSON.stringify(after.extras) !== JSON.stringify(before.extras)) patch.extras = after.extras;
  if (after.crunchLevel !== before.crunchLevel) patch.crunchLevel = after.crunchLevel;
  if (after.isAvailable !== before.isAvailable) patch.isAvailable = after.isAvailable;
  return patch;
};

export const handleUpdateProduct = async (id: string, updates: Partial<MenuItem>) => {
  const payload = mapMenuItemPatchToUpdate(updates);
  const { data, error } = await supabase
    .from(PRODUCTS_TABLE)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  notifyProductMutation();
  return mapRowToMenuItem(data as ProductRow);
};

export const upsertProduct = async (item: MenuItem) => {
  const payload = mapMenuItemToInsert(item);
  const { data, error } = await supabase
    .from(PRODUCTS_TABLE)
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;
  notifyProductMutation();
  return mapRowToMenuItem(data as ProductRow);
};

export const deleteProduct = async (id: string) => {
  const { error } = await supabase.from(PRODUCTS_TABLE).delete().eq('id', id);
  if (error) throw error;
  notifyProductMutation();
};

export const updateProductSortOrder = async (id: string, sortOrder: number) => {
  const { error } = await supabase
    .from(PRODUCTS_TABLE)
    .update({ sort_order: sortOrder } as any)
    .eq('id', id);
  if (error) throw error;
};

export const subscribeProductsRealtime = (onChange: () => void) => {
  const channel = supabase
    .channel(`products-live-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: PRODUCTS_TABLE },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const fetchMenuExtras = async (): Promise<MenuExtra[]> => {
  const client = supabase as any;
  const { data, error } = await client
    .from(MENU_EXTRAS_TABLE)
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data as MenuExtraRow[]).map(mapMenuExtraRow);
};

export const upsertMenuExtra = async (extra: MenuExtra) => {
  const client = supabase as any;
  const payload = {
    id: extra.id,
    name_sq: extra.name.sq,
    name_en: extra.name.en,
    price: extra.price,
    is_active: extra.isActive,
    sort_order: extra.sortOrder,
  };

  const { data, error } = await client
    .from(MENU_EXTRAS_TABLE)
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;
  return mapMenuExtraRow(data as MenuExtraRow);
};

export const deleteMenuExtra = async (id: string) => {
  const client = supabase as any;
  const { error } = await client.from(MENU_EXTRAS_TABLE).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeMenuExtrasRealtime = (onChange: () => void) => {
  const channel = supabase
    .channel(`menu-extras-live-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: MENU_EXTRAS_TABLE },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

const deleteProductImageByUrl = async (imageUrl: string): Promise<void> => {
  if (!imageUrl) return;
  const marker = `/${PRODUCT_IMAGE_BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return;
  const path = decodeURIComponent(imageUrl.slice(idx + marker.length).split('?')[0]);
  await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
};

export const uploadProductImage = async (file: File, productId: string, oldImageUrl?: string) => {
  if (oldImageUrl) await deleteProductImageByUrl(oldImageUrl);

  const processed = await compressImage(file);
  const path = `${productId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, processed, { upsert: false, contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};
