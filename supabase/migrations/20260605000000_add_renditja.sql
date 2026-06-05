-- Add daily sequential order number (RENDITJA) that resets to 1 each day (Pristina timezone)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS renditja INTEGER;

CREATE OR REPLACE FUNCTION public.set_order_renditja()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.renditja := (
    SELECT COALESCE(MAX(renditja), 0) + 1
    FROM public.orders
    WHERE (created_at AT TIME ZONE 'Europe/Pristina')::DATE
        = (NOW() AT TIME ZONE 'Europe/Pristina')::DATE
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_renditja ON public.orders;
CREATE TRIGGER trg_set_renditja
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_renditja();
