-- Routes each order to the correct admin panel at creation time.
-- 'qender'    → shown only in main /admin
-- 'cagllavice' → shown in both /admin and /admincg
-- Computed via Haversine distance to each restaurant at order placement.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS suggested_location text NOT NULL DEFAULT 'qender';
