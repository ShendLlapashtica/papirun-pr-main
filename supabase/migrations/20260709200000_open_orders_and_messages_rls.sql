-- Prior two migrations (20260709180000, 20260709190000) tried to correctly scope
-- orders/order_messages access to admin vs driver vs customer via is_admin() and
-- auth.role() checks. That still wasn't restoring working order/chat flow, and
-- further correctness debugging was explicitly called off in favor of guaranteed
-- function. Fully open, no restrictions beyond RLS being enabled at all.

DROP POLICY IF EXISTS "Admins full access" ON public.orders;
DROP POLICY IF EXISTS "Customers view own orders" ON public.orders;
CREATE POLICY "Admins full access" ON public.orders
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "view order messages" ON public.order_messages;
CREATE POLICY "view order messages" ON public.order_messages
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "send order messages" ON public.order_messages;
CREATE POLICY "send order messages" ON public.order_messages
  FOR INSERT TO public WITH CHECK (true);
