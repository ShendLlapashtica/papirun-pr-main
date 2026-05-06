-- Add real-time location tracking and color identity to delivery drivers
ALTER TABLE delivery_drivers
  ADD COLUMN IF NOT EXISTS lat   NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lng   NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS color TEXT    DEFAULT NULL;

-- Assign palette colors to the 6 seeded drivers (matched by phone = username)
UPDATE delivery_drivers SET color = '#ef4444' WHERE phone = 'driver1';
UPDATE delivery_drivers SET color = '#3b82f6' WHERE phone = 'driver2';
UPDATE delivery_drivers SET color = '#22c55e' WHERE phone = 'driver3';
UPDATE delivery_drivers SET color = '#eab308' WHERE phone = 'driver4';
UPDATE delivery_drivers SET color = '#a855f7' WHERE phone = 'driver5';
UPDATE delivery_drivers SET color = '#f97316' WHERE phone = 'driver6';
