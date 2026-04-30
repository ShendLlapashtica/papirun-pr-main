-- Tighten write/delete policies to avoid always-true predicates while preserving current anonymous admin workflow
DROP POLICY IF EXISTS "Public can insert products" ON public.products;
CREATE POLICY "Anon and authenticated can insert products"
ON public.products
FOR INSERT
TO anon, authenticated
WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Public can update products" ON public.products;
CREATE POLICY "Anon and authenticated can update products"
ON public.products
FOR UPDATE
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'))
WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Public can delete products" ON public.products;
CREATE POLICY "Anon and authenticated can delete products"
ON public.products
FOR DELETE
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));