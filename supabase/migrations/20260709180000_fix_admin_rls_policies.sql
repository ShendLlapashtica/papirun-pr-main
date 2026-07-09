-- Fixes RLS policies that were written when the admin panel had no real Supabase
-- session (auth.role() = 'anon') and were never updated when admin login switched
-- to real supabase.auth.signInWithPassword() sessions (see 20260608010000_secure_orders.sql).
--
-- Two consequences of the drift:
--   1) order_messages' SELECT policy still only recognized the old 'anon' admin
--      session, so admin could INSERT a chat message but not read it back. Since
--      sendOrderMessage() does insert().select().single(), the blocked read-back
--      throws — which aborts the entire order-approval flow (status update + driver
--      assignment never run) for any order placed by a logged-in customer.
--   2) orders' "Admins full access" policy checked auth.role() = 'authenticated',
--      which is true for ANY logged-in customer, not just admins — granting every
--      customer full read/write/delete access to every other customer's orders.
--
-- Admin accounts are reliably identifiable: the admin login always signs in as
-- `${username}@papirun.net` (src/pages/Admin.tsx) — a domain only staff accounts
-- use; customers authenticate with their own email via TAN/OTP.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '') LIKE '%@papirun.net';
$$;

-- orders: restrict "full access" to real admins; add back customers' visibility into their own orders
DROP POLICY IF EXISTS "Admins full access" ON public.orders;
CREATE POLICY "Admins full access" ON public.orders
  FOR ALL USING (public.is_admin());

CREATE POLICY "Customers view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

-- order_messages: admin visibility keyed off real admin identity instead of the stale anon-session assumption
DROP POLICY IF EXISTS "view order messages" ON public.order_messages;
CREATE POLICY "view order messages" ON public.order_messages
FOR SELECT TO public
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_messages.order_id
      AND (o.user_id = auth.uid() OR o.user_id IS NULL)
  )
);
