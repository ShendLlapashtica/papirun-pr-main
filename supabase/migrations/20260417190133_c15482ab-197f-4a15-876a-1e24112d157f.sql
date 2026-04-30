-- 1. status_history column on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Trigger function to append status changes
CREATE OR REPLACE FUNCTION public.append_order_status_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status_history = jsonb_build_array(
      jsonb_build_object(
        'status', NEW.status,
        'note', COALESCE(NEW.admin_note, ''),
        'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.admin_note IS DISTINCT FROM OLD.admin_note THEN
    NEW.status_history = COALESCE(OLD.status_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'status', NEW.status,
        'note', COALESCE(NEW.admin_note, ''),
        'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_append_order_status_history ON public.orders;
CREATE TRIGGER trg_append_order_status_history
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.append_order_status_history();

-- 3. Marketing subscribers table
CREATE TABLE IF NOT EXISTS public.marketing_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  lang text NOT NULL DEFAULT 'sq',
  user_id uuid,
  consented_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe"
ON public.marketing_subscribers
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view own subscription"
ON public.marketing_subscribers
FOR SELECT
USING (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR auth.role() = 'service_role'));

-- 4. Realtime for orders (idempotent)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders REPLICA IDENTITY FULL;