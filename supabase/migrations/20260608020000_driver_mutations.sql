-- Driver: update a single order's status (bypasses RLS for PIN-authed drivers)
CREATE OR REPLACE FUNCTION driver_update_order_status(
  p_order_id uuid,
  p_status text
)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = p_status,
      updated_at = now()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;

-- Driver: fetch orders assigned to this driver (bypasses RLS)
CREATE OR REPLACE FUNCTION driver_fetch_orders(p_driver_id uuid)
RETURNS SETOF public.orders
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT * FROM public.orders
    WHERE assigned_driver_id = p_driver_id
    ORDER BY created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Driver: archive all active orders at midnight (bypasses RLS)
CREATE OR REPLACE FUNCTION driver_archive_active_orders()
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'histori',
      is_visible = false,
      updated_at = now()
  WHERE status IN ('pending', 'approved', 'preparing', 'out_for_delivery');
END;
$$ LANGUAGE plpgsql;

-- Guest: rate a driver after delivery (bypasses RLS for anonymous callers)
CREATE OR REPLACE FUNCTION guest_rate_driver(
  p_order_id uuid,
  p_rating int,
  p_note text DEFAULT NULL
)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  UPDATE public.orders
  SET driver_rating = p_rating,
      driver_rating_note = COALESCE(p_note, driver_rating_note),
      updated_at = now()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;
