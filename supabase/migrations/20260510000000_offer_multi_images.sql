-- Add multi-image support to storefront_offers
ALTER TABLE public.storefront_offers
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}'::text[];

-- Migrate existing single image_url into the new array column
UPDATE public.storefront_offers
SET image_urls = ARRAY[image_url]
WHERE image_url <> '' AND (array_length(image_urls, 1) IS NULL);
