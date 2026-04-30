-- 1. Order messages chat table
CREATE TABLE public.order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user', 'admin')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_messages_order_id ON public.order_messages(order_id, created_at);

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages on their own orders; anon (admin) can view all
CREATE POLICY "view order messages"
  ON public.order_messages FOR SELECT
  USING (
    auth.role() = 'anon'
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (o.user_id = auth.uid() OR auth.role() = 'anon')
    )
  );

-- Users can send messages as 'user' on their own orders; anon (admin) can send as 'admin'
CREATE POLICY "send order messages"
  ON public.order_messages FOR INSERT
  WITH CHECK (
    (sender = 'admin' AND auth.role() = 'anon')
    OR (
      sender = 'user'
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_messages.order_id
          AND o.user_id = auth.uid()
      )
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;

-- 2. Quick replies table
CREATE TABLE public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('reject', 'approve', 'chat')),
  text_sq text NOT NULL,
  text_en text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read quick replies"
  ON public.quick_replies FOR SELECT USING (true);

CREATE POLICY "Anon and auth manage quick replies (insert)"
  ON public.quick_replies FOR INSERT
  WITH CHECK (auth.role() = ANY (ARRAY['anon', 'authenticated']));

CREATE POLICY "Anon and auth manage quick replies (update)"
  ON public.quick_replies FOR UPDATE
  USING (auth.role() = ANY (ARRAY['anon', 'authenticated']))
  WITH CHECK (auth.role() = ANY (ARRAY['anon', 'authenticated']));

CREATE POLICY "Anon and auth manage quick replies (delete)"
  ON public.quick_replies FOR DELETE
  USING (auth.role() = ANY (ARRAY['anon', 'authenticated']));

CREATE TRIGGER trg_quick_replies_updated
  BEFORE UPDATE ON public.quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.quick_replies (type, text_sq, text_en, sort_order) VALUES
  ('reject', 'Jashtë zonës së dërgesës', 'Outside delivery zone', 1),
  ('reject', 'Mbyllur tani', 'Currently closed', 2),
  ('reject', 'Produkti pa stok', 'Product out of stock', 3),
  ('reject', 'Gabim porosie', 'Order error', 4),
  ('approve', 'Po e përgatisim porosinë tuaj', 'We are preparing your order', 1),
  ('approve', 'Do jetë gati në 20 minuta', 'Ready in 20 minutes', 2),
  ('approve', 'Niset shumë shpejt', 'Out for delivery soon', 3),
  ('chat', 'Faleminderit për porosinë!', 'Thank you for your order!', 1),
  ('chat', 'Po e shqyrtojmë', 'We are reviewing it', 2),
  ('chat', 'Çfarë shtese dëshironi?', 'What extras would you like?', 3),
  ('chat', 'Mund ta dorëzojmë në 30 minuta', 'We can deliver in 30 minutes', 4);

-- 3. Orders source column
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web';

-- 4. Orders prep_eta_minutes
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS prep_eta_minutes integer;