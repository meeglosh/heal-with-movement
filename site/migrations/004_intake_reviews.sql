ALTER TABLE intakes ADD COLUMN reviewed_at timestamptz;
UPDATE intakes SET reviewed_at=completed_at;
ALTER TABLE intakes ALTER COLUMN reviewed_at SET DEFAULT now();
ALTER TABLE intakes ALTER COLUMN reviewed_at SET NOT NULL;
ALTER TABLE adult_intakes ADD COLUMN reviewed_at timestamptz;
UPDATE adult_intakes SET reviewed_at=completed_at;
ALTER TABLE adult_intakes ALTER COLUMN reviewed_at SET DEFAULT now();
ALTER TABLE adult_intakes ALTER COLUMN reviewed_at SET NOT NULL;
CREATE TABLE intake_review_history (id uuid PRIMARY KEY, actor_id text NOT NULL REFERENCES portal_users(id), child_id uuid REFERENCES children(id), subject_user_id text REFERENCES portal_users(id), encrypted_payload text NOT NULL, version integer NOT NULL, reviewed_at timestamptz NOT NULL, archived_at timestamptz NOT NULL DEFAULT now());
