BEGIN;
SET LOCAL search_path = simus, public;
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  endpoint_hash text NOT NULL CHECK (endpoint_hash ~ '^[0-9a-f]{64}$'),
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz,
  FOREIGN KEY (session_id,participant_id) REFERENCES participant_sessions(session_id,participant_id) ON DELETE RESTRICT,
  UNIQUE(session_id,participant_id,endpoint_hash)
);
CREATE TABLE push_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES simulation_sessions(id) ON DELETE RESTRICT,
  subscription_id uuid NOT NULL REFERENCES push_subscriptions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENDING','SENT','FAILED','CANCELLED')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  UNIQUE(session_id,subscription_id)
);
CREATE INDEX push_jobs_ready ON push_jobs(status,next_attempt_at);
REVOKE ALL ON push_subscriptions,push_jobs FROM PUBLIC;
COMMIT;
