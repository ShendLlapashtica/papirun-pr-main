import type { CartItem } from '@/types/menu';

/**
 * Single source of truth for how an order's items are grouped for display.
 * The admin panel (OrdersReview) and the customer cart/checkout surfaces all
 * group through here, so the two panels can never drift apart:
 * "2x Sanduiç" header + "↳ 1x Pa domate" sub-line for modified units.
 */

export interface GroupedOrderItem {
  id: string;
  name?: { sq: string; en: string };
  category?: string;
  image?: string;
  totalQty: number;
  modifiedItems: Array<{
    qty: number;
    removed: string[];
    extras: Array<{ name: { sq: string; en: string }; price: number }>;
    note?: string;
  }>;
}

/** Receipt-style grouping (moved verbatim from OrdersReview) — display only. */
export function groupOrderItems(items: any[]): GroupedOrderItem[] {
  const map = new Map<string, GroupedOrderItem>();
  for (const it of items) {
    if (!map.has(it.id)) {
      map.set(it.id, { id: it.id, name: it.name, category: it.category, image: it.image, totalQty: 0, modifiedItems: [] });
    }
    const entry = map.get(it.id)!;
    entry.totalQty += it.quantity ?? 1;
    const note = it.customerNote?.trim() || undefined;
    if ((it.removedIngredients?.length ?? 0) > 0 || (it.addedExtras?.length ?? 0) > 0 || note) {
      entry.modifiedItems.push({
        qty: it.quantity ?? 1,
        removed: it.removedIngredients ?? [],
        extras: it.addedExtras ?? [],
        note,
      });
    }
  }
  return Array.from(map.values());
}

export interface GroupedCartLines {
  id: string;
  name: { sq: string; en: string };
  image: string;
  totalQty: number;
  /** The original cart lines of this product, in insertion order — each still
   *  individually addressable via getCartItemKey for qty/note/delete controls. */
  lines: CartItem[];
}

/** Same grouping (by product id) but keeps the live CartItem lines, for the
 *  editable carts where every variant row must retain its own controls. */
export function groupCartLines(items: CartItem[]): GroupedCartLines[] {
  const map = new Map<string, GroupedCartLines>();
  for (const item of items) {
    if (!map.has(item.id)) {
      map.set(item.id, { id: item.id, name: item.name, image: item.image, totalQty: 0, lines: [] });
    }
    const entry = map.get(item.id)!;
    entry.totalQty += item.quantity;
    entry.lines.push(item);
  }
  return Array.from(map.values());
}
