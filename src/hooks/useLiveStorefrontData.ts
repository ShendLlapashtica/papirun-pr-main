import { useEffect, useState } from 'react';
import { menuItems as initialMenuItems, ofertaRamazani as initialOffers } from '@/data/menuData';
import { defaultMenuExtras } from '@/data/menuExtras';
import type { MenuItem } from '@/types/menu';
import type { MenuExtra } from '@/types/menuExtra';
import type { OfferItem } from '@/data/menuData';
import {
  ensureSeedMenuExtras,
  ensureSeedProducts,
  ensureSeedStorefrontOffers,
  ensureStorefrontSetting,
  fetchMenuExtras,
  fetchProducts,
  fetchStorefrontOffers,
  fetchStorefrontSetting,
  subscribeProductsRealtime,
  subscribeMenuExtrasRealtime,
  subscribeStorefrontOffersRealtime,
  subscribeStorefrontSettingsRealtime,
} from '@/lib/productsApi';
import { OFFERS_SECTION_ENABLED_KEY, OFFER_BADGE_TEXT_KEY, DEFAULT_OFFER_BADGE_TEXT } from '@/lib/storefrontApi';

// Build a lookup of local bundled images by product id
const localImageMap = new Map<string, string>();
initialMenuItems.forEach((item) => {
  if (item.image) localImageMap.set(item.id, item.image);
});

// --- Lightweight localStorage cache with TTL ---
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  ts: number;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch { /* quota exceeded — ignore */ }
}

const PRODUCTS_CACHE_KEY = 'papirun_products_cache';
const EXTRAS_CACHE_KEY = 'papirun_extras_cache';
const OFFERS_CACHE_KEY = 'papirun_storefront_offers_cache';
const OFERTA_ENABLED_CACHE_KEY = 'papirun_storefront_offers_enabled_cache';
const SEED_DONE_KEY = 'papirun_seed_done';

// Only seed once per browser ever (not on every visit)
function hasSeedRun(): boolean {
  return localStorage.getItem(SEED_DONE_KEY) === '1';
}
function markSeedDone() {
  localStorage.setItem(SEED_DONE_KEY, '1');
}

const applyLocalImages = (items: MenuItem[]): MenuItem[] =>
  items.map((item) => {
    const hasValidImage = item.image && !item.image.startsWith('/src/') && item.image.startsWith('http');
    if (!hasValidImage) {
      const localImg = localImageMap.get(item.id);
      if (localImg) return { ...item, image: localImg };
    }
    return item;
  });

export const useLiveMenuItems = () => {
  const cached = readCache<MenuItem[]>(PRODUCTS_CACHE_KEY);
  // Apply localImageMap immediately to fix stale hash paths from previous builds
  const initialItems = cached ? applyLocalImages(cached) : initialMenuItems;
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [isLoading, setIsLoading] = useState(!cached);

  useEffect(() => {
    let isMounted = true;

    const syncFromDatabase = async () => {
      const timeout = setTimeout(() => {
        if (isMounted && isLoading) {
          setItems(applyLocalImages(initialMenuItems));
          setIsLoading(false);
        }
      }, 5000);

      try {
        if (!hasSeedRun()) {
          await ensureSeedProducts(initialMenuItems);
          markSeedDone();
        }
        const liveItems = await fetchProducts();
        clearTimeout(timeout);

        const merged = applyLocalImages(liveItems);
        if (isMounted) {
          setItems(merged);
          setIsLoading(false);
          writeCache(PRODUCTS_CACHE_KEY, merged);
        }
      } catch (error) {
        clearTimeout(timeout);
        console.error('Failed to sync products from database:', error);
        if (isMounted) {
          setItems(applyLocalImages(initialMenuItems));
          setIsLoading(false);
        }
      }
    };

    if (cached) {
      setIsLoading(false);
      const timer = setTimeout(syncFromDatabase, 2000);
      const unsubRealtime = subscribeProductsRealtime(() => syncFromDatabase());
      return () => { isMounted = false; clearTimeout(timer); unsubRealtime(); };
    }

    syncFromDatabase();

    const unsubRealtime = subscribeProductsRealtime(() => syncFromDatabase());
    return () => { isMounted = false; unsubRealtime(); };
  }, []);

  return { items, isLoading };
};

export const useLiveMenuExtras = () => {
  const cached = readCache<MenuExtra[]>(EXTRAS_CACHE_KEY);
  const [extras, setExtras] = useState<MenuExtra[]>(cached ?? defaultMenuExtras);

  useEffect(() => {
    let isMounted = true;

    const syncFromDatabase = async () => {
      try {
        if (!hasSeedRun()) {
          await ensureSeedMenuExtras(defaultMenuExtras);
        }
        const liveExtras = await fetchMenuExtras();
        if (isMounted) {
          setExtras(liveExtras);
          writeCache(EXTRAS_CACHE_KEY, liveExtras);
        }
      } catch (error) {
        console.error('Failed to sync menu extras from database:', error);
      }
    };

    if (cached) {
      const timer = setTimeout(syncFromDatabase, 2000);
      const unsubRealtime = subscribeMenuExtrasRealtime(() => syncFromDatabase());
      return () => { isMounted = false; clearTimeout(timer); unsubRealtime(); };
    }

    syncFromDatabase();
    const unsubRealtime = subscribeMenuExtrasRealtime(() => syncFromDatabase());
    return () => { isMounted = false; unsubRealtime(); };
  }, []);

  return extras;
};

export const useOfertaEnabled = () => {
  const cached = readCache<boolean>(OFERTA_ENABLED_CACHE_KEY);
  const [isEnabled, setIsEnabled] = useState<boolean>(cached ?? true);

  useEffect(() => {
    let isMounted = true;

    const sync = async () => {
      try {
        await ensureStorefrontSetting(OFFERS_SECTION_ENABLED_KEY, true);
        const nextValue = await fetchStorefrontSetting<boolean>(OFFERS_SECTION_ENABLED_KEY, true);
        if (isMounted) {
          setIsEnabled(nextValue);
          writeCache(OFERTA_ENABLED_CACHE_KEY, nextValue);
        }
      } catch {
        if (isMounted && cached !== null) {
          setIsEnabled(cached);
        }
      }
    };

    sync();
    const unsubscribe = subscribeStorefrontSettingsRealtime(sync);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return isEnabled;
};

export const useLiveVisibleOffers = () => {
  // NEVER seed from local fallback — DB is source of truth.
  // Empty array + loading flag prevents flash of deleted/hidden offers.
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const sync = async () => {
      const timeout = setTimeout(() => {
        if (isMounted && isLoading) {
          console.warn('Supabase offers fetch timed out');
          setIsLoading(false);
        }
      }, 5000);

      try {
        await ensureSeedStorefrontOffers(initialOffers);
        const liveOffers = await fetchStorefrontOffers();
        clearTimeout(timeout);
        
        const visibleOffers = liveOffers
          .filter((offer) => offer.isActive)
          .map(({ isActive: _isActive, sortOrder: _sortOrder, ...offer }) => offer);

        if (isMounted) {
          setOffers(visibleOffers);
          setIsLoading(false);
          writeCache(OFFERS_CACHE_KEY, visibleOffers);
        }
      } catch {
        clearTimeout(timeout);
        if (isMounted) setIsLoading(false);
      }
    };

    sync();
    const unsubscribe = subscribeStorefrontOffersRealtime(sync);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return { offers, isLoading };
};

export const useOfferBadgeText = () => {
  const [badgeText, setBadgeText] = useState(DEFAULT_OFFER_BADGE_TEXT);

  useEffect(() => {
    let isMounted = true;
    const sync = async () => {
      try {
        const val = await fetchStorefrontSetting<string>(OFFER_BADGE_TEXT_KEY, DEFAULT_OFFER_BADGE_TEXT);
        if (isMounted) setBadgeText(val || DEFAULT_OFFER_BADGE_TEXT);
      } catch { /* keep default */ }
    };
    sync();
    const unsubscribe = subscribeStorefrontSettingsRealtime(sync);
    return () => { isMounted = false; unsubscribe(); };
  }, []);

  return badgeText;
};
