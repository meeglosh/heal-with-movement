ALTER TABLE booking_flows DROP CONSTRAINT IF EXISTS booking_flows_service_check;
ALTER TABLE booking_flows ADD CONSTRAINT booking_flows_service_check CHECK (service IN ('vermont','montreal','virtual','virtual_private'));
