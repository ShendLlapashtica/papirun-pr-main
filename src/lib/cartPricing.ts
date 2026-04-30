import type { CartItem } from '@/types/menu';

const getSingleItemExtrasPrice = (item: CartItem) =>
  (item.addedExtras ?? []).reduce((sum, extra) => sum + extra.price, 0);

export const getCartLineTotal = (item: CartItem) => (item.price + getSingleItemExtrasPrice(item)) * item.quantity;

export const getCartTotal = (items: CartItem[]) => items.reduce((sum, item) => sum + getCartLineTotal(item), 0);
