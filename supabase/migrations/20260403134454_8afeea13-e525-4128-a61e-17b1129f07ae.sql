ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Set initial sort_order based on current created_at order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.products
)
UPDATE public.products
SET sort_order = ranked.rn
FROM ranked
WHERE public.products.id = ranked.id;