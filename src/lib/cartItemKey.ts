import type { CartItem } from '@/types/menu';
import type { SelectedExtra } from '@/types/menuExtra';

const normalizeIds = (values: string[]) => [...values].sort().join(',');

const normalizeExtras = (extras: SelectedExtra[]) =>
  [...extras]
    .map((extra) => extra.id)
    .sort()
    .join(',');

export const getCartItemKey = (
  item: Pick<CartItem, 'id' | 'removedIngredients' | 'addedExtras'>
) => `${item.id}__${normalizeIds(item.removedIngredients ?? [])}__${normalizeExtras(item.addedExtras ?? [])}`;