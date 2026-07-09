-- get_order_by_id was defined in 20260608010000_secure_orders.sql but was missing
-- from the live database (confirmed via direct API test: calls to this RPC returned
-- PGRST202 "function not found"). Every customer-facing order status check goes
-- through this function (src/lib/ordersApi.ts fetchOrder, used by
-- OrderTrackingPill.tsx on every poll) — silently failing on every call, wrapped in
-- an empty catch{}, so the UI never advanced past the optimistic "#OPTIMIST..."
-- placeholder and the post-approval chat card never opened. Not caused by anything
-- changed today — reproduced against the fully-reverted, pre-today codebase.
-- Restoring the original definition, unchanged.

CREATE OR REPLACE FUNCTION get_order_by_id(p_order_id uuid)
RETURNS SETOF public.orders
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.orders WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;
