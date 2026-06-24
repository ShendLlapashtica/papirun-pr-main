-- Allow 'drink' as a valid product category
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('salad', 'fajita', 'sandwich', 'sides', 'drink'));
