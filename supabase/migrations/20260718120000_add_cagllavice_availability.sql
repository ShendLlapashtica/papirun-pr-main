-- Independent per-branch availability flag: lets the Cagllavicë-scoped admin
-- mark a product as not stocked at that branch without touching the global
-- is_available flag used by Papirun Qendër.
ALTER TABLE public.products
  ADD COLUMN is_available_cagllavice boolean NOT NULL DEFAULT true;
