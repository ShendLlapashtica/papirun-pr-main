export interface ProductAvailability {
  id: string;
  is_available: boolean;
}

export const getUnavailableProductIds = (
  requestedIds: string[],
  products: ProductAvailability[],
): string[] => {
  const availableIds = new Set(products.filter((product) => product.is_available).map((product) => product.id));
  return [...new Set(requestedIds)].filter((id) => !availableIds.has(id));
};
