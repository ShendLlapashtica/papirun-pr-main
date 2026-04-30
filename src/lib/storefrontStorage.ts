import type { MenuItem } from '@/types/menu';
import type { OfferItem } from '@/data/menuData';

export const STOREFRONT_MENU_KEY = 'papirun_menu_items';
export const STOREFRONT_OFFERS_KEY = 'papirun_offers_data';
export const STOREFRONT_OFFERS_TOGGLE_KEY = 'papirun_offers_toggle';
export const STOREFRONT_OFERTA_ENABLED_KEY = 'papirun_oferta_ramazani';
const STOREFRONT_UPDATE_EVENT = 'papirun-storefront-updated';

const isBrowser = () => typeof window !== 'undefined';

const readJSON = <T>(key: string, fallback: T): T => {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const emitStorefrontUpdate = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(STOREFRONT_UPDATE_EVENT));
};

export const getStoredMenuItems = (fallback: MenuItem[]): MenuItem[] =>
  readJSON<MenuItem[]>(STOREFRONT_MENU_KEY, fallback);

export const setStoredMenuItems = (items: MenuItem[]) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STOREFRONT_MENU_KEY, JSON.stringify(items));
  emitStorefrontUpdate();
};

export const getStoredOffers = (fallback: OfferItem[]): OfferItem[] =>
  readJSON<OfferItem[]>(STOREFRONT_OFFERS_KEY, fallback);

export const setStoredOffers = (offers: OfferItem[]) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STOREFRONT_OFFERS_KEY, JSON.stringify(offers));
  emitStorefrontUpdate();
};

export const getStoredOffersToggle = (): Record<string, boolean> =>
  readJSON<Record<string, boolean>>(STOREFRONT_OFFERS_TOGGLE_KEY, {});

export const setStoredOffersToggle = (toggleMap: Record<string, boolean>) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STOREFRONT_OFFERS_TOGGLE_KEY, JSON.stringify(toggleMap));
  emitStorefrontUpdate();
};

export const getStoredOfertaEnabled = (fallback = true): boolean => {
  if (!isBrowser()) return fallback;
  const value = window.localStorage.getItem(STOREFRONT_OFERTA_ENABLED_KEY);
  return value !== 'false';
};

export const setStoredOfertaEnabled = (enabled: boolean) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STOREFRONT_OFERTA_ENABLED_KEY, String(enabled));
  emitStorefrontUpdate();
};

export const subscribeStorefrontUpdates = (callback: () => void) => {
  if (!isBrowser()) return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (
      !event.key ||
      [
        STOREFRONT_MENU_KEY,
        STOREFRONT_OFFERS_KEY,
        STOREFRONT_OFFERS_TOGGLE_KEY,
        STOREFRONT_OFERTA_ENABLED_KEY,
      ].includes(event.key)
    ) {
      callback();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(STOREFRONT_UPDATE_EVENT, callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(STOREFRONT_UPDATE_EVENT, callback);
  };
};
