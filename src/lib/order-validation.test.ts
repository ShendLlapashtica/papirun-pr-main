import { describe, expect, it } from 'vitest';
import { getUnavailableProductIds } from '../../api/order-validation';

describe('getUnavailableProductIds', () => {
  it('flags deleted and unavailable products while accepting available products', () => {
    expect(
      getUnavailableProductIds(
        ['available', 'sold-out', 'deleted'],
        [
          { id: 'available', is_available: true },
          { id: 'sold-out', is_available: false },
        ],
      ),
    ).toEqual(['sold-out', 'deleted']);
  });

  it('returns each unavailable product id only once', () => {
    expect(getUnavailableProductIds(['deleted', 'deleted'], [])).toEqual(['deleted']);
  });
});
