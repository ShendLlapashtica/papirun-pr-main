CREATE TABLE IF NOT EXISTS public.storefront_offers (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  image_url text NOT NULL DEFAULT '',
  includes text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storefront_settings (
  key text PRIMARY KEY,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.storefront_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'storefront_offers' AND policyname = 'Public can read storefront offers'
  ) THEN
    CREATE POLICY "Public can read storefront offers"
    ON public.storefront_offers
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'storefront_offers' AND policyname = 'Anon and authenticated can insert storefront offers'
  ) THEN
    CREATE POLICY "Anon and authenticated can insert storefront offers"
    ON public.storefront_offers
    FOR INSERT
    TO public
    WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'storefront_offers' AND policyname = 'Anon and authenticated can update storefront offers'
  ) THEN
    CREATE POLICY "Anon and authenticated can update storefront offers"
    ON public.storefront_offers
    FOR UPDATE
    TO public
    USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]))
    WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'storefront_offers' AND policyname = 'Anon and authenticated can delete storefront offers'
  ) THEN
    CREATE POLICY "Anon and authenticated can delete storefront offers"
    ON public.storefront_offers
    FOR DELETE
    TO public
    USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'storefront_settings' AND policyname = 'Public can read storefront settings'
  ) THEN
    CREATE POLICY "Public can read storefront settings"
    ON public.storefront_settings
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'storefront_settings' AND policyname = 'Anon and authenticated can insert storefront settings'
  ) THEN
    CREATE POLICY "Anon and authenticated can insert storefront settings"
    ON public.storefront_settings
    FOR INSERT
    TO public
    WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'storefront_settings' AND policyname = 'Anon and authenticated can update storefront settings'
  ) THEN
    CREATE POLICY "Anon and authenticated can update storefront settings"
    ON public.storefront_settings
    FOR UPDATE
    TO public
    USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]))
    WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'storefront_settings' AND policyname = 'Anon and authenticated can delete storefront settings'
  ) THEN
    CREATE POLICY "Anon and authenticated can delete storefront settings"
    ON public.storefront_settings
    FOR DELETE
    TO public
    USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_storefront_offers_updated_at ON public.storefront_offers;
CREATE TRIGGER update_storefront_offers_updated_at
BEFORE UPDATE ON public.storefront_offers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_storefront_settings_updated_at ON public.storefront_settings;
CREATE TRIGGER update_storefront_settings_updated_at
BEFORE UPDATE ON public.storefront_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_storefront_offers_sort_order ON public.storefront_offers(sort_order);

ALTER PUBLICATION supabase_realtime ADD TABLE public.storefront_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.storefront_settings;