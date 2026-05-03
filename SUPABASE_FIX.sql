-- ============================================================
-- PAPIRUN: Run this in the Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/qnojgwrwqmfoayvgedtu/sql/new
-- ============================================================

-- 1. Add missing columns to delivery_drivers
ALTER TABLE public.delivery_drivers
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pin TEXT NOT NULL DEFAULT 'Pass123.';

-- 2. Drop and recreate RLS policies on delivery_drivers (ensure all are open)
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read drivers" ON public.delivery_drivers;
CREATE POLICY "Public can read drivers" ON public.delivery_drivers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert drivers" ON public.delivery_drivers;
CREATE POLICY "Public can insert drivers" ON public.delivery_drivers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update drivers" ON public.delivery_drivers;
CREATE POLICY "Public can update drivers" ON public.delivery_drivers FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can delete drivers" ON public.delivery_drivers;
CREATE POLICY "Public can delete drivers" ON public.delivery_drivers FOR DELETE USING (true);

-- 3. Add to realtime publication (safe if already there)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_drivers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Add missing columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS driver_rating SMALLINT CHECK (driver_rating IS NULL OR (driver_rating >= 1 AND driver_rating <= 5)),
  ADD COLUMN IF NOT EXISTS driver_rating_note TEXT;

-- 5. Fix order_messages: allow 'driver' sender
ALTER TABLE public.order_messages
  DROP CONSTRAINT IF EXISTS order_messages_sender_check;
ALTER TABLE public.order_messages
  ADD CONSTRAINT order_messages_sender_check
  CHECK (sender IN ('user', 'admin', 'driver'));

-- 6. Fix order_messages INSERT policy (allow anon users to send)
DROP POLICY IF EXISTS "send order messages" ON public.order_messages;
CREATE POLICY "send order messages"
ON public.order_messages FOR INSERT TO public
WITH CHECK (
  (sender = 'admin' AND auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]))
  OR (sender = 'driver' AND auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]))
  OR (sender = 'user')
);

-- 7. Fix order_messages SELECT policy (allow anon to read)
DROP POLICY IF EXISTS "view order messages" ON public.order_messages;
CREATE POLICY "view order messages"
ON public.order_messages FOR SELECT TO public
USING (
  auth.role() = 'anon'
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_messages.order_id
      AND (o.user_id = auth.uid() OR o.user_id IS NULL)
  )
);

-- 8. Seed 6 default drivers (idempotent - won't duplicate)
INSERT INTO public.delivery_drivers (name, phone, pin, is_active)
VALUES
  ('Delivery1', '', 'Pass123.', true),
  ('Delivery2', '', 'Pass123.', true),
  ('Delivery3', '', 'Pass123.', true),
  ('Delivery4', '', 'Pass123.', true),
  ('Delivery5', '', 'Pass123.', true),
  ('Delivery6', '', 'Pass123.', true)
ON CONFLICT DO NOTHING;
