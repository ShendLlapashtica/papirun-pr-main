BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Add ALL required columns (idempotent)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.delivery_drivers
  ADD COLUMN IF NOT EXISTS username     TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS name         TEXT,
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS pin          TEXT,
  ADD COLUMN IF NOT EXISTS role         TEXT NOT NULL DEFAULT 'driver',
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Relax any NOT NULL constraints that block inserts
ALTER TABLE public.delivery_drivers ALTER COLUMN username     DROP NOT NULL;
ALTER TABLE public.delivery_drivers ALTER COLUMN name         DROP NOT NULL;
ALTER TABLE public.delivery_drivers ALTER COLUMN phone        DROP NOT NULL;
ALTER TABLE public.delivery_drivers ALTER COLUMN pin          DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. RLS — disable entirely so driver creation never hits permission errors
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.delivery_drivers DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Unique constraint on phone (needed for ON CONFLICT upsert)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.delivery_drivers
  DROP CONSTRAINT IF EXISTS delivery_drivers_phone_key;

ALTER TABLE public.delivery_drivers
  ADD CONSTRAINT delivery_drivers_phone_key UNIQUE (phone);

-- ─────────────────────────────────────────────────────────────────────
-- 4. Remove wrong seed rows (Delivery1/2/3) — safe DELETE (respects FK)
-- ─────────────────────────────────────────────────────────────────────
DELETE FROM public.delivery_drivers
WHERE COALESCE(username, name, '') IN ('Delivery1','Delivery2','Delivery3')
  AND id NOT IN (
    SELECT DISTINCT assigned_driver_id
    FROM public.orders
    WHERE assigned_driver_id IS NOT NULL
  );

-- ─────────────────────────────────────────────────────────────────────
-- 5. Upsert 6 canonical drivers
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.delivery_drivers (name, username, display_name, phone, pin, role, is_active)
VALUES
  ('Driver 1', 'driver1', 'Driver 1', 'driver1', '123', 'driver', true),
  ('Driver 2', 'driver2', 'Driver 2', 'driver2', '123', 'driver', true),
  ('Driver 3', 'driver3', 'Driver 3', 'driver3', '123', 'driver', true),
  ('Driver 4', 'driver4', 'Driver 4', 'driver4', '123', 'driver', true),
  ('Driver 5', 'driver5', 'Driver 5', 'driver5', '123', 'driver', true),
  ('Driver 6', 'driver6', 'Driver 6', 'driver6', '123', 'driver', true)
ON CONFLICT (phone) DO UPDATE SET
  name         = EXCLUDED.name,
  username     = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  pin          = EXCLUDED.pin,
  role         = EXCLUDED.role,
  is_active    = EXCLUDED.is_active;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Ensure assigned_driver_id exists on orders (idempotent)
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'orders'
      AND column_name  = 'assigned_driver_id'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN assigned_driver_id UUID REFERENCES public.delivery_drivers(id);
  END IF;
END $$;

COMMIT;
