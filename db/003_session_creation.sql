-- 기존 001/002 이후 적용. 회차 복제 요청의 멱등성과 시작 기준 진행 시간을 보존한다.
BEGIN;
CREATE TABLE simus.session_creation_requests (
  admin_id uuid NOT NULL REFERENCES simus.admin_users(id),
  request_key uuid NOT NULL,
  session_id uuid NOT NULL UNIQUE REFERENCES simus.simulation_sessions(id),
  template_session_id uuid NOT NULL REFERENCES simus.simulation_sessions(id),
  name text NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 10 AND 86400),
  impact_scale numeric(18,10) NOT NULL CHECK (impact_scale BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, request_key)
);
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON simus.session_creation_requests
  FOR EACH ROW EXECUTE FUNCTION simus.reject_mutation();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON simus.session_creation_requests
  FOR EACH STATEMENT EXECUTE FUNCTION simus.reject_mutation();
COMMIT;
