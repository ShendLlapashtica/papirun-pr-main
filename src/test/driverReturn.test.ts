import { describe, expect, it } from 'vitest';
import { isLiveDriverOrder } from '@/lib/ordersApi';

describe('isLiveDriverOrder', () => {
  it('treats only visible orders from today as live', () => {
    const now = new Date(2026, 8, 30, 12);

    expect(isLiveDriverOrder({ createdAt: new Date(2026, 8, 30, 10).toISOString(), isVisible: true }, now)).toBe(true);
    expect(isLiveDriverOrder({ createdAt: new Date(2026, 8, 29, 10).toISOString(), isVisible: true }, now)).toBe(false);
    expect(isLiveDriverOrder({ createdAt: new Date(2026, 8, 30, 10).toISOString(), isVisible: false }, now)).toBe(false);
  });
});