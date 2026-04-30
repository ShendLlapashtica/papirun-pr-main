-- Allow ANY user (anon or authenticated) to send a 'user' message for any order they can read.
-- Rationale: orders.SELECT is public (anon can place orders without login). Previous policy required
-- o.user_id = auth.uid() which made it impossible for anon customers to send chat messages.

DROP POLICY IF EXISTS "send order messages" ON public.order_messages;

CREATE POLICY "send order messages"
ON public.order_messages
FOR INSERT
TO public
WITH CHECK (
  -- admin replies (anon admin tools)
  ((sender = 'admin') AND (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text])))
  OR
  -- customer messages: must reference an existing order. Anon customers allowed
  -- because orders RLS is public; authenticated users restricted to their own orders.
  ((sender = 'user') AND (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (
          o.user_id IS NULL
          OR o.user_id = auth.uid()
          OR auth.role() = 'anon'
        )
    )
  ))
);