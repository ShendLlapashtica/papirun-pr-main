-- Fix 1: allow 'driver' as a valid sender (previous constraint only had 'user' | 'admin')
ALTER TABLE public.order_messages
  DROP CONSTRAINT IF EXISTS order_messages_sender_check;

ALTER TABLE public.order_messages
  ADD CONSTRAINT order_messages_sender_check
  CHECK (sender IN ('user', 'admin', 'driver'));

-- Fix 2: replace the INSERT policy with one that unblocks anon customers.
-- The original policy required o.user_id = auth.uid() which always fails for
-- anonymous users because auth.uid() returns NULL for anon sessions.
-- The order_id itself acts as the access token — anyone who knows it can chat.
DROP POLICY IF EXISTS "send order messages" ON public.order_messages;

CREATE POLICY "send order messages"
ON public.order_messages
FOR INSERT
TO public
WITH CHECK (
  -- admin can send as 'admin' from either anon or authenticated session
  (sender = 'admin' AND auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]))
  OR
  -- drivers can send as 'driver' (driver panel uses anon Supabase key)
  (sender = 'driver' AND auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]))
  OR
  -- customers (anon or authenticated) can send as 'user'
  -- order_id is the implicit proof of access
  (sender = 'user')
);

-- Fix 3: ensure the SELECT policy allows anon customers to see messages on their orders
-- (needed for realtime subscription to deliver messages back to the customer)
DROP POLICY IF EXISTS "view order messages" ON public.order_messages;

CREATE POLICY "view order messages"
ON public.order_messages
FOR SELECT
TO public
USING (
  -- admin (anon in this app) sees all messages
  auth.role() = 'anon'
  OR
  -- authenticated users see messages on their own orders OR orders with no owner
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_messages.order_id
      AND (o.user_id = auth.uid() OR o.user_id IS NULL)
  )
);
