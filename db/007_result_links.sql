-- A result link is a read-only, per-session bearer credential. Store its hash only.
BEGIN;
SET LOCAL search_path = simus, public;
CREATE TABLE result_links (
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (session_id, participant_id),
  FOREIGN KEY (session_id, participant_id) REFERENCES participant_sessions(session_id, participant_id) ON DELETE RESTRICT,
  CHECK (expires_at > created_at)
);
CREATE INDEX result_links_expiry ON result_links(expires_at);
REVOKE ALL ON result_links FROM PUBLIC;
COMMIT;
