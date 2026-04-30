-- Delivery drivers table
CREATE TABLE IF NOT EXISTS public.delivery_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pin TEXT NOT NULL DEFAULT '0000',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read drivers" ON public.delivery_drivers;
CREATE POLICY "Public can read drivers"
ON public.delivery_drivers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert drivers" ON public.delivery_drivers;
CREATE POLICY "Public can insert drivers"
ON public.delivery_drivers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update drivers" ON public.delivery_drivers;
CREATE POLICY "Public can update drivers"
ON public.delivery_drivers FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can delete drivers" ON public.delivery_drivers;
CREATE POLICY "Public can delete drivers"
ON public.delivery_drivers FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_drivers;

-- Add driver assignment columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES public.delivery_drivers(id),
  ADD COLUMN IF NOT EXISTS driver_rating SMALLINT CHECK (driver_rating IS NULL OR (driver_rating >= 1 AND driver_rating <= 5));
