-- Enable RLS on orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop any existing open policies
DROP POLICY IF EXISTS "Public can read orders" ON public.orders;
DROP POLICY IF EXISTS "Anon and auth can update orders" ON public.orders;
DROP POLICY IF EXISTS "Anon and auth can delete orders" ON public.orders;

-- Authenticated admins/drivers can read/update/delete all
CREATE POLICY "Admins full access" ON public.orders
  FOR ALL USING (auth.role() = 'authenticated');

-- Guests (anon) can only place new orders (insert)
CREATE POLICY "Guests can place orders" ON public.orders
  FOR INSERT WITH CHECK (true);

-- Secure function for guest order tracking by UUID (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_order_by_id(p_order_id uuid)
RETURNS SETOF public.orders
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.orders WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;
