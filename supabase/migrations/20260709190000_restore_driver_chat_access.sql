-- Corrects 20260709180000_fix_admin_rls_policies.sql: that migration replaced
-- order_messages' `auth.role() = 'anon'` SELECT branch with `is_admin()`, which
-- fixed admin (now a real authenticated session) but broke drivers — DriverPanel.tsx
-- is PIN-based and never calls supabase.auth.*, so driver sessions are ALSO anon and
-- were relying on that same branch to read/send chat messages (sendOrderMessage's
-- insert().select().single() read-back was silently blocked, so driver sends failed
-- outright). Restore anon access alongside is_admin() — drivers and admin both need
-- to be covered now that they're on different session types.

DROP POLICY IF EXISTS "view order messages" ON public.order_messages;
CREATE POLICY "view order messages" ON public.order_messages
FOR SELECT TO public
USING (
  auth.role() = 'anon'
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_messages.order_id
      AND (o.user_id = auth.uid() OR o.user_id IS NULL)
  )
);
