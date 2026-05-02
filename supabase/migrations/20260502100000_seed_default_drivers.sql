-- Seed default delivery drivers (Delivery1/2/3 with Pass123) if not already present
INSERT INTO public.delivery_drivers (name, phone, pin, is_active)
SELECT 'Delivery1', '', 'Pass123', true
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_drivers WHERE name = 'Delivery1');

INSERT INTO public.delivery_drivers (name, phone, pin, is_active)
SELECT 'Delivery2', '', 'Pass123', true
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_drivers WHERE name = 'Delivery2');

INSERT INTO public.delivery_drivers (name, phone, pin, is_active)
SELECT 'Delivery3', '', 'Pass123', true
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_drivers WHERE name = 'Delivery3');
