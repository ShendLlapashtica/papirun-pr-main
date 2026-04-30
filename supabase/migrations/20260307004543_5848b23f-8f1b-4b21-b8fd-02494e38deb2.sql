CREATE TABLE IF NOT EXISTS public.menu_extras (
  id TEXT PRIMARY KEY,
  name_sq TEXT NOT NULL,
  name_en TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_extras ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'menu_extras' AND policyname = 'Public can read menu extras'
  ) THEN
    CREATE POLICY "Public can read menu extras"
    ON public.menu_extras
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'menu_extras' AND policyname = 'Anon and authenticated can insert menu extras'
  ) THEN
    CREATE POLICY "Anon and authenticated can insert menu extras"
    ON public.menu_extras
    FOR INSERT
    WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'menu_extras' AND policyname = 'Anon and authenticated can update menu extras'
  ) THEN
    CREATE POLICY "Anon and authenticated can update menu extras"
    ON public.menu_extras
    FOR UPDATE
    USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]))
    WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'menu_extras' AND policyname = 'Anon and authenticated can delete menu extras'
  ) THEN
    CREATE POLICY "Anon and authenticated can delete menu extras"
    ON public.menu_extras
    FOR DELETE
    USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_menu_extras_updated_at'
  ) THEN
    CREATE TRIGGER update_menu_extras_updated_at
    BEFORE UPDATE ON public.menu_extras
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_extras;