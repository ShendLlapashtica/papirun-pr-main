-- Backfill suggested_location for active orders using correct branch coordinates.
-- Çagllavicë: (42.6280, 21.1730)  |  Qendra: (42.6629, 21.1655)
-- Leaves completed/history orders untouched.
UPDATE public.orders
SET suggested_location = CASE
  WHEN delivery_address ILIKE '%cagllavic%' THEN 'cagllavice'
  WHEN delivery_lat IS NULL OR delivery_lng IS NULL THEN 'qender'
  WHEN (
    6371 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(delivery_lat - 42.6280) / 2), 2) +
      COS(RADIANS(delivery_lat)) * COS(RADIANS(42.6280)) *
      POWER(SIN(RADIANS(delivery_lng - 21.1730) / 2), 2)
    ))
  ) < (
    6371 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(delivery_lat - 42.6629) / 2), 2) +
      COS(RADIANS(delivery_lat)) * COS(RADIANS(42.6629)) *
      POWER(SIN(RADIANS(delivery_lng - 21.1655) / 2), 2)
    ))
  ) THEN 'cagllavice'
  ELSE 'qender'
END
WHERE status IN ('pending', 'approved', 'preparing', 'out_for_delivery', 'rejected');
