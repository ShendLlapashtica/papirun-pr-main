import { describe, it, expect, vi } from 'vitest';
import type { MenuItem } from '@/types/menu';

// diffMenuItem is a pure function, but productsApi.ts also constructs a real Supabase
// client at import time — stub that out so this test doesn't depend on env config.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const { diffMenuItem } = await import('@/lib/productsApi');

const baseItem: MenuItem = {
  id: 'super-salad-crunch',
  name: { sq: 'Sallatë', en: 'Salad' },
  description: { sq: 'Përshkrim', en: 'Description' },
  price: 5.5,
  image: 'https://example.com/salad.jpg',
  category: 'salad',
  ingredients: ['salate', 'domate'],
  extras: ['ekstra-djath'],
  crunchLevel: 3,
  likes: 10,
  rating: 4.5,
  reviewCount: 20,
  isAvailable: true,
};

describe('diffMenuItem', () => {
  it('returns only the price when just the price changed', () => {
    const after = { ...baseItem, price: 6.0 };
    expect(diffMenuItem(baseItem, after)).toEqual({ price: 6.0 });
  });

  it('never includes extras when extras were not touched, even if other fields changed', () => {
    const after = { ...baseItem, price: 6.0, image: 'https://example.com/new-salad.jpg' };
    const patch = diffMenuItem(baseItem, after);
    expect(patch).toEqual({ price: 6.0, image: 'https://example.com/new-salad.jpg' });
    expect(patch.extras).toBeUndefined();
  });

  it('returns an empty patch when nothing changed', () => {
    const after = { ...baseItem };
    expect(diffMenuItem(baseItem, after)).toEqual({});
  });

  it('includes extras only when the extras array actually changed', () => {
    const after = { ...baseItem, extras: ['ekstra-djath', 'ekstra-beef'] };
    expect(diffMenuItem(baseItem, after)).toEqual({ extras: ['ekstra-djath', 'ekstra-beef'] });
  });

  it('produces a full patch when every field changed (covers the new-product save path)', () => {
    const after: MenuItem = {
      id: baseItem.id,
      name: { sq: 'Sallatë e Re', en: 'New Salad' },
      description: { sq: 'Përshkrim i ri', en: 'New description' },
      price: 7.25,
      image: 'https://example.com/updated.jpg',
      category: 'sides',
      ingredients: ['salate'],
      extras: [],
      crunchLevel: 1,
      likes: 10,
      rating: 4.5,
      reviewCount: 20,
      isAvailable: false,
    };
    expect(diffMenuItem(baseItem, after)).toEqual({
      name: after.name,
      description: after.description,
      price: after.price,
      image: after.image,
      category: after.category,
      ingredients: after.ingredients,
      extras: after.extras,
      crunchLevel: after.crunchLevel,
      isAvailable: after.isAvailable,
    });
  });
});
