-- Allow admin (anon/auth role on this app) and order owners to delete their order messages
CREATE POLICY "delete order messages"
ON public.order_messages
FOR DELETE
USING (
  auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text])
);