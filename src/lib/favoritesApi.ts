import { supabase } from '@/integrations/supabase/client';

export interface FavoriteRow {
  id: string;
  product_id: string;
  created_at: string;
}

export const fetchFavorites = async (userId: string): Promise<string[]> => {
  const client = supabase as any;
  const { data, error } = await client
    .from('user_favorites')
    .select('product_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r: { product_id: string }) => r.product_id);
};

export const addFavorite = async (userId: string, productId: string) => {
  const client = supabase as any;
  const { error } = await client
    .from('user_favorites')
    .insert({ user_id: userId, product_id: productId });
  if (error && !String(error.message).includes('duplicate')) throw error;
};

export const removeFavorite = async (userId: string, productId: string) => {
  const client = supabase as any;
  const { error } = await client
    .from('user_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);
  if (error) throw error;
};
