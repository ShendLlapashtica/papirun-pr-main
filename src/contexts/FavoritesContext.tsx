import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { fetchFavorites, addFavorite, removeFavorite } from '@/lib/favoritesApi';

interface FavoritesCtx {
  favorites: Set<string>;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<FavoritesCtx | null>(null);

export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { setFavorites(new Set()); return; }
    let cancelled = false;
    setLoading(true);
    fetchFavorites(user.id)
      .then((ids) => { if (!cancelled) setFavorites(new Set(ids)); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  const toggleFavorite = useCallback(async (productId: string) => {
    if (!user) return;
    const has = favorites.has(productId);
    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev);
      if (has) next.delete(productId); else next.add(productId);
      return next;
    });
    try {
      if (has) await removeFavorite(user.id, productId);
      else await addFavorite(user.id, productId);
    } catch {
      // Rollback
      setFavorites((prev) => {
        const next = new Set(prev);
        if (has) next.add(productId); else next.delete(productId);
        return next;
      });
    }
  }, [user, favorites]);

  return (
    <Ctx.Provider value={{ favorites, isFavorite: (id) => favorites.has(id), toggleFavorite, loading }}>
      {children}
    </Ctx.Provider>
  );
};

export const useFavorites = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFavorites must be inside FavoritesProvider');
  return ctx;
};
