CREATE TABLE adult_intakes (user_id text PRIMARY KEY REFERENCES portal_users(id), encrypted_payload text NOT NULL, version integer NOT NULL DEFAULT 1, completed_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE audit_events ADD COLUMN subject_user_id text REFERENCES portal_users(id);
