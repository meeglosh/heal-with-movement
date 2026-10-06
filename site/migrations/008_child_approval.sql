ALTER TABLE children ADD COLUMN approved_at timestamptz;
UPDATE children c SET approved_at = b.first_accepted FROM (SELECT child_id, min(updated_at) AS first_accepted FROM bookings WHERE child_id IS NOT NULL AND status = 'accepted' AND service <> 'virtual' GROUP BY child_id) b WHERE b.child_id = c.id
