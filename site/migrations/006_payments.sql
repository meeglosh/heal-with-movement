CREATE TABLE payments (id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES portal_users(id), kind text NOT NULL CHECK (kind IN ('private_lesson','group_credits')), flow_id uuid REFERENCES booking_flows(id), start_at timestamptz, time_zone text, attendee_name text, amount integer NOT NULL, currency text NOT NULL, credits integer NOT NULL DEFAULT 0, stripe_session_id text UNIQUE, stripe_payment_intent text, status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','expired','refunded')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX payments_user_idx ON payments(user_id);
CREATE INDEX payments_flow_idx ON payments(flow_id);
CREATE TABLE credit_balances (user_id text PRIMARY KEY REFERENCES portal_users(id), balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0));
CREATE TABLE credit_ledger (id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES portal_users(id), delta integer NOT NULL, reason text NOT NULL CHECK (reason IN ('purchase','booking','restore')), payment_id uuid REFERENCES payments(id), booking_id uuid REFERENCES bookings(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX credit_purchase_once ON credit_ledger(payment_id) WHERE reason = 'purchase';
CREATE UNIQUE INDEX credit_restore_once ON credit_ledger(booking_id) WHERE reason = 'restore';
ALTER TABLE bookings ADD COLUMN payment_id uuid REFERENCES payments(id);
ALTER TABLE bookings ADD COLUMN uses_credit boolean NOT NULL DEFAULT false
