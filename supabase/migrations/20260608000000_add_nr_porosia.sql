ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS nr_porosia integer;

CREATE OR REPLACE FUNCTION assign_daily_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' AND NEW.nr_porosia IS NULL THEN
    NEW.nr_porosia := COALESCE(
      (SELECT MAX(nr_porosia)
       FROM public.orders
       WHERE created_at::date = NEW.created_at::date),
      0
    ) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_assign_daily_order_number
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION assign_daily_order_number();
