-- Fix: renditja should be assigned on CONFIRM (status → approved), not on INSERT.
-- NR1 = 1st order confirmed today, NR2 = 2nd, etc. Resets each day (Pristina TZ).

-- Ensure column exists (idempotent — safe if previous migration already ran)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS renditja INTEGER;

-- Drop old INSERT-based trigger (wrong behaviour — fired on every new order)
DROP TRIGGER IF EXISTS trg_set_renditja ON public.orders;
DROP FUNCTION IF EXISTS public.set_order_renditja();

-- Clear renditja from non-approved orders so they get a proper number on approval
UPDATE public.orders
SET renditja = NULL
WHERE status NOT IN ('approved', 'preparing', 'out_for_delivery', 'completed', 'histori')
  AND renditja IS NOT NULL;

-- New trigger: assign renditja when status transitions TO 'approved'
CREATE OR REPLACE FUNCTION public.set_renditja_on_approve()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM 'approved')
     AND NEW.renditja IS NULL
  THEN
    NEW.renditja := (
      SELECT COALESCE(MAX(renditja), 0) + 1
      FROM public.orders
      WHERE (created_at AT TIME ZONE 'Europe/Pristina')::DATE
          = (NOW() AT TIME ZONE 'Europe/Pristina')::DATE
        AND renditja IS NOT NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_renditja_on_approve ON public.orders;
CREATE TRIGGER trg_renditja_on_approve
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_renditja_on_approve();
