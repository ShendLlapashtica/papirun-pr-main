-- Ensure driver rating columns exist (idempotent)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS driver_rating_note TEXT,
  ADD COLUMN IF NOT EXISTS delivery_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_completed_at TIMESTAMPTZ;
