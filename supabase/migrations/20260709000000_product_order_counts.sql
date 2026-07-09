-- Read-only aggregate of how many times each product has actually been
-- ordered, derived from the orders.items jsonb snapshots. No PII is
-- returned (no customer name/address/phone) and no table is written to.
-- Mirrors the existing SECURITY DEFINER pattern used by get_order_by_id
-- (see 20260608010000_secure_orders.sql) to expose one narrow, safe read
-- path without granting broad access to the orders table.
CREATE OR REPLACE FUNCTION get_product_order_counts()
RETURNS TABLE(product_id uuid, total_qty bigint)
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (item->>'id')::uuid AS product_id,
    SUM(COALESCE((item->>'quantity')::int, 1)) AS total_qty
  FROM public.orders, jsonb_array_elements(items) AS item
  WHERE item->>'id' IS NOT NULL
  GROUP BY (item->>'id')::uuid;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION get_product_order_counts() TO anon, authenticated;
