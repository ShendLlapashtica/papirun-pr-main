-- Archive table for deleted chat messages (so they survive in admin history)
CREATE TABLE IF NOT EXISTS public.order_messages_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  sender text NOT NULL,
  message text NOT NULL,
  original_created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_messages_archive_order_id
  ON public.order_messages_archive(order_id);

ALTER TABLE public.order_messages_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read archived chat (anon + auth)"
ON public.order_messages_archive
FOR SELECT
USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));

CREATE POLICY "Insert archived chat (anon + auth)"
ON public.order_messages_archive
FOR INSERT
WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));

CREATE POLICY "Delete archived chat (anon + auth)"
ON public.order_messages_archive
FOR DELETE
USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));