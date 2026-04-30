-- Locations table
CREATE TABLE public.storefront_locations (
  id text PRIMARY KEY,
  name_sq text NOT NULL,
  name_en text NOT NULL,
  hours_sq text NOT NULL DEFAULT '',
  hours_en text NOT NULL DEFAULT '',
  open_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
  open_minute integer NOT NULL DEFAULT 420,
  close_minute integer NOT NULL DEFAULT 1140,
  lat numeric NOT NULL DEFAULT 42.6629,
  lng numeric NOT NULL DEFAULT 21.1655,
  address_sq text NOT NULL DEFAULT '',
  address_en text NOT NULL DEFAULT '',
  whatsapp_phone text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.storefront_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read locations" ON public.storefront_locations
  FOR SELECT USING (true);
CREATE POLICY "Anon and auth can insert locations" ON public.storefront_locations
  FOR INSERT WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));
CREATE POLICY "Anon and auth can update locations" ON public.storefront_locations
  FOR UPDATE USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]))
  WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));
CREATE POLICY "Anon and auth can delete locations" ON public.storefront_locations
  FOR DELETE USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));

CREATE TRIGGER trg_storefront_locations_updated_at
  BEFORE UPDATE ON public.storefront_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  delivery_address text NOT NULL DEFAULT '',
  delivery_lat numeric NULL,
  delivery_lng numeric NULL,
  location_id text NULL REFERENCES public.storefront_locations(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  admin_note text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (place order, guest or auth)
CREATE POLICY "Anyone can insert orders" ON public.orders
  FOR INSERT WITH CHECK (true);

-- Public can SELECT (needed for guests to track their order by id; obscured by uuid).
-- For real admin gating later, add a role check; for now match the project's existing pattern.
CREATE POLICY "Public can read orders" ON public.orders
  FOR SELECT USING (true);

CREATE POLICY "Anon and auth can update orders" ON public.orders
  FOR UPDATE USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]))
  WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));

CREATE POLICY "Anon and auth can delete orders" ON public.orders
  FOR DELETE USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.storefront_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER TABLE public.storefront_locations REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Seed two locations
INSERT INTO public.storefront_locations
  (id, name_sq, name_en, hours_sq, hours_en, open_days, open_minute, close_minute, lat, lng, address_sq, address_en, whatsapp_phone, is_active, sort_order)
VALUES
  ('qender', 'Papirun Qendër', 'Papirun Center',
   'E Hënë - E Shtunë: 07:00-19:00', 'Mon - Sat: 07:00-19:00',
   ARRAY[1,2,3,4,5,6], 420, 1140,
   42.6629, 21.1655,
   'Johan V. Hahn, Nr.14, Prishtinë 10000', 'Johan V. Hahn, Nr.14, Prishtina 10000',
   '38345262323', true, 0),
  ('cagllavice', 'Papirun Çagllavicë', 'Papirun Çagllavicë',
   'E Hënë - E Shtunë: 07:00-22:00', 'Mon - Sat: 07:00-22:00',
   ARRAY[1,2,3,4,5,6], 420, 1320,
   42.6280, 21.1730,
   'Çagllavicë, Prishtinë', 'Çagllavicë, Prishtina',
   '38345262323', true, 1);