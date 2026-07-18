import { useEffect, useState } from 'react';
import type { OrderLocation } from '@/lib/ordersApi';
import type { MenuItem } from '@/types/menu';

const GATE_CACHE_KEY = 'papirun_location_choice';
const GATE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CHANGE_EVENT = 'papirun-location-choice-changed';

export interface LocationChoice {
  branch: OrderLocation;
}

interface CacheEntry {
  data: LocationChoice;
  ts: number;
}

export const getSavedLocationChoice = (): LocationChoice | null => {
  try {
    const raw = localStorage.getItem(GATE_CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > GATE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
};

export const saveLocationChoice = (choice: LocationChoice): void => {
  try {
    const entry: CacheEntry = { data: choice, ts: Date.now() };
    localStorage.setItem(GATE_CACHE_KEY, JSON.stringify(entry));
  } catch { /* quota exceeded — ignore */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

export const clearLocationChoice = (): void => {
  try { localStorage.removeItem(GATE_CACHE_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

// Reactive read of the picked branch — updates live (no reload needed) when
// saveLocationChoice/clearLocationChoice run anywhere in the app, e.g. via
// the banner's "change" tap.
export const useViewerBranch = (): OrderLocation | null => {
  const [branch, setBranch] = useState<OrderLocation | null>(() => getSavedLocationChoice()?.branch ?? null);

  useEffect(() => {
    const sync = () => setBranch(getSavedLocationChoice()?.branch ?? null);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  return branch;
};

// Routes where the branch gate/banner must NOT appear: the app-shell (still a
// separate, deferred pass) and staff/utility routes that aren't a customer
// ordering surface. Everything else — homepage, product pages, offer pages —
// is a place a customer could reach checkout from, so the gate applies there.
const EXEMPT_ROUTE_PREFIXES = [
  '/home',
  '/app/product',
  '/admin',
  '/driver',
  '/login',
  '/invoice',
  '/privacy',
  '/auth/callback',
  '/signup',
  '/verify',
];

export const isGateExemptRoute = (pathname: string): boolean => {
  const p = pathname.toLowerCase();
  return EXEMPT_ROUTE_PREFIXES.some((prefix) => p.startsWith(prefix));
};

// Hides products the Çagllavicë admin has switched off for that branch, but
// only when the viewer has actually picked Çagllavicë at the gate. Qendër
// visitors (and anyone who hasn't picked yet) see the full, untouched list —
// this must never be called against admin-facing product lists.
export const filterMenuItemsForBranch = (items: MenuItem[], branch: OrderLocation | null): MenuItem[] => {
  if (branch !== 'cagllavice') return items;
  return items.filter((item) => item.isAvailableOnCagllavice);
};
