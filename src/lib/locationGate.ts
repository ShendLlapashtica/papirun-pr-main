import type { OrderLocation } from '@/lib/ordersApi';

const GATE_CACHE_KEY = 'papirun_location_choice';
const GATE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
};

export const clearLocationChoice = (): void => {
  try { localStorage.removeItem(GATE_CACHE_KEY); } catch { /* ignore */ }
};
