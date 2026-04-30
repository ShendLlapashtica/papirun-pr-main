import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { MenuItem } from '@/types/menu';
import type { MenuExtra } from '@/types/menuExtra';
export {
  OFFERS_SECTION_ENABLED_KEY,
  SITE_TEXTS_SETTING_KEY,
  type StorefrontOffer,
  deleteStorefrontOffer,
  ensureSeedStorefrontOffers,
  ensureStorefrontSetting,
  fetchStorefrontOffers,
  fetchStorefrontSetting,
  handleUpdateStorefrontOffer,
  subscribeStorefrontOffersRealtime,
  subscribeStorefrontSettingsRealtime,
  upsertStorefrontOffer,
  upsertStorefrontSetting,
  uploadStorefrontOfferImage,
} from '@/lib/storefrontApi';

const PRODUCTS_TABLE = 'products';
const MENU_EXTRAS_TABLE = 'menu_extras';
const PRODUCT_IMAGE_BUCKET = 'product-images';

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
  likes: item.likes,
  rating: item.rating,
  review_count: item.reviewCount,
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
  if (typeof updates.likes === 'number') payload.likes = updates.likes;
  if (typeof updates.rating === 'number') payload.rating = updates.rating;
  if (typeof updates.reviewCount === 'number') payload.review_count = updates.reviewCount;
  if (typeof updates.isAvailable === 'boolean') payload.is_available = updates.isAvailable;

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

export const ensureSeedProducts = async (fallbackItems: MenuItem[]) => {
  const { count, error: countError } = await supabase
    .from(PRODUCTS_TABLE)
    .select('*', { count: 'exact', head: true });

  if (countError) throw countError;
  if ((count ?? 0) > 0) return;

  const payload = fallbackItems.map(mapMenuItemToInsert);
  const { error } = await supabase.from(PRODUCTS_TABLE).upsert(payload, { onConflict: 'id' });
  if (error) throw error;
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
  return mapRowToMenuItem(data as ProductRow);
};

export const deleteProduct = async (id: string) => {
  const { error } = await supabase.from(PRODUCTS_TABLE).delete().eq('id', id);
  if (error) throw error;
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
    .channel('products-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: PRODUCTS_TABLE }, onChange)
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

export const ensureSeedMenuExtras = async (fallbackExtras: MenuExtra[]) => {
  const client = supabase as any;
  const { count, error: countError } = await client
    .from(MENU_EXTRAS_TABLE)
    .select('*', { count: 'exact', head: true });

  if (countError) throw countError;
  if ((count ?? 0) > 0) return;

  const payload = fallbackExtras.map((extra) => ({
    id: extra.id,
    name_sq: extra.name.sq,
    name_en: extra.name.en,
    price: extra.price,
    is_active: extra.isActive,
    sort_order: extra.sortOrder,
  }));

  const { error } = await client.from(MENU_EXTRAS_TABLE).upsert(payload, { onConflict: 'id' });
  if (error) throw error;
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
    .channel('menu-extras-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: MENU_EXTRAS_TABLE }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const uploadProductImage = async (file: File, productId: string) => {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${productId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw error;

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};
