ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_orders_is_visible ON public.orders(is_visible);