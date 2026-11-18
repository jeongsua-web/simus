BEGIN;
ALTER TABLE simus.session_creation_requests
  DROP CONSTRAINT session_creation_requests_duration_seconds_check,
  ADD CONSTRAINT session_creation_requests_duration_seconds_check
    CHECK (duration_seconds BETWEEN 10 AND 604800);
COMMIT;
