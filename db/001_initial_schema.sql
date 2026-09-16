-- SIM:US 시제품 스키마 v0.1 / PostgreSQL 14+
-- 기존 데이터베이스에서 1회 실행: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/001_initial_schema.sql
-- 데이터베이스 자체와 로그인 역할은 별도로 생성한다. 기존 테이블을 삭제하지 않는다.
-- 시간은 timestamptz, 표시 시간대는 애플리케이션에서 Asia/Seoul로 변환한다.
BEGIN;
CREATE SCHEMA simus;
SET LOCAL search_path = simus, public;

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject text NOT NULL UNIQUE,
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN admin_users.auth_subject IS
  '외부 인증 제공자의 변경되지 않는 사용자 식별자(OIDC sub 또는 동등한 값). 이메일이나 표시 이름을 저장하지 않는다.';

CREATE TABLE simulation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','RUNNING','CLOSING','FINALIZED')),
  starts_at timestamptz,
  scheduled_end_at timestamptz NOT NULL,
  -- 요구사항의 종료 직전 입력 차단 구간. 시제품 기본값은 5초이며 회차 시작 전에 확정한다.
  admission_buffer interval NOT NULL DEFAULT interval '5 seconds'
    CHECK (admission_buffer > interval '0 seconds'),
  -- auto_cutoff_at은 timestamptz 산술의 generated column 제한을 피하고 뷰에서 계산한다.
  admission_closed_at timestamptz,
  end_requested_at timestamptz,
  actual_ended_at timestamptz,
  finalized_at timestamptz,
  end_mode text CHECK (end_mode IN ('AUTO','MANUAL')),
  ended_by_admin_id uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
  expected_participants integer NOT NULL CHECK (expected_participants > 0),
  expected_answers_per_person integer NOT NULL CHECK (expected_answers_per_person > 0),
  impact_scale numeric(18,10) NOT NULL CHECK (impact_scale >= 0),
  rules_snapshot jsonb NOT NULL CHECK (jsonb_typeof(rules_snapshot) = 'object'),
  pollution_aggregation text NOT NULL DEFAULT 'WEIGHTED_MEAN'
    CHECK (pollution_aggregation = 'WEIGHTED_MEAN'),
  created_by_admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at IS NULL OR scheduled_end_at > starts_at + admission_buffer),
  CHECK ((end_mode IS NULL AND ended_by_admin_id IS NULL)
      OR (end_mode = 'AUTO' AND ended_by_admin_id IS NULL)
      OR (end_mode = 'MANUAL' AND ended_by_admin_id IS NOT NULL)),
  CHECK (status = 'DRAFT' OR starts_at IS NOT NULL),
  CHECK (status NOT IN ('CLOSING','FINALIZED') OR
    (end_mode IS NOT NULL AND admission_closed_at IS NOT NULL AND end_requested_at IS NOT NULL)),
  CHECK (status <> 'FINALIZED' OR (actual_ended_at IS NOT NULL AND finalized_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_active_session ON simulation_sessions ((true))
  WHERE status IN ('RUNNING','CLOSING');
CREATE INDEX sessions_by_status_created ON simulation_sessions(status, created_at DESC);
CREATE VIEW session_timing AS
  SELECT id AS session_id, status, scheduled_end_at, admission_buffer,
    scheduled_end_at - admission_buffer AS auto_cutoff_at
  FROM simulation_sessions;

CREATE TABLE participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE participant_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at IS NULL OR expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX credentials_participant ON participant_credentials(participant_id);
CREATE INDEX credentials_expiry_cleanup ON participant_credentials(expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX credentials_revocation_cleanup ON participant_credentials(revoked_at)
  WHERE revoked_at IS NOT NULL;
CREATE TABLE participant_sessions (
  session_id uuid NOT NULL REFERENCES simulation_sessions(id) ON DELETE RESTRICT,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, participant_id)
);
CREATE INDEX participant_session_history ON participant_sessions(participant_id, joined_at DESC);

CREATE TABLE session_situations (
  session_id uuid NOT NULL REFERENCES simulation_sessions(id) ON DELETE RESTRICT,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, id),
  UNIQUE (session_id, code)
);
CREATE TABLE session_choices (
  session_id uuid NOT NULL,
  situation_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  label text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  importance text NOT NULL DEFAULT 'NORMAL' CHECK (importance IN ('NORMAL','MAJOR')),
  alignment_dx smallint NOT NULL DEFAULT 0,
  alignment_dy smallint NOT NULL DEFAULT 0,
  happiness_base numeric(20,10) NOT NULL DEFAULT 0,
  safety_base numeric(20,10) NOT NULL DEFAULT 0,
  cleanliness_base numeric(20,10) NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, situation_id, id),
  FOREIGN KEY (session_id, situation_id) REFERENCES session_situations(session_id,id) ON DELETE RESTRICT,
  CHECK ((importance = 'NORMAL' AND alignment_dx BETWEEN -1 AND 1 AND alignment_dy BETWEEN -1 AND 1)
      OR (importance = 'MAJOR' AND alignment_dx BETWEEN -2 AND 2 AND alignment_dy BETWEEN -2 AND 2))
);
CREATE TABLE session_regions (
  session_id uuid NOT NULL REFERENCES simulation_sessions(id) ON DELETE RESTRICT,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  aggregation_weight numeric(20,10) NOT NULL DEFAULT 1 CHECK (aggregation_weight > 0 AND aggregation_weight <> 'NaN'::numeric),
  map_metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(map_metadata) = 'object'),
  PRIMARY KEY (session_id,id),
  UNIQUE (session_id,code)
);
CREATE TABLE choice_region_effects (
  session_id uuid NOT NULL,
  situation_id uuid NOT NULL,
  choice_id uuid NOT NULL,
  region_id uuid NOT NULL,
  pollution_base numeric(20,10) NOT NULL,
  PRIMARY KEY (session_id,situation_id,choice_id,region_id),
  FOREIGN KEY (session_id,situation_id,choice_id) REFERENCES session_choices(session_id,situation_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (session_id,region_id) REFERENCES session_regions(session_id,id) ON DELETE RESTRICT
);

CREATE TABLE participant_alignments (
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  x_score bigint NOT NULL DEFAULT 0,
  y_score bigint NOT NULL DEFAULT 0,
  response_count bigint NOT NULL DEFAULT 0 CHECK (response_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id,participant_id),
  FOREIGN KEY (session_id,participant_id) REFERENCES participant_sessions(session_id,participant_id) ON DELETE RESTRICT
);
CREATE TABLE city_states (
  session_id uuid PRIMARY KEY REFERENCES simulation_sessions(id) ON DELETE RESTRICT,
  happiness numeric(20,10) NOT NULL DEFAULT 50 CHECK (happiness BETWEEN 0 AND 100),
  safety numeric(20,10) NOT NULL DEFAULT 50 CHECK (safety BETWEEN 0 AND 100),
  cleanliness numeric(20,10) NOT NULL DEFAULT 50 CHECK (cleanliness BETWEEN 0 AND 100),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE region_states (
  session_id uuid NOT NULL,
  region_id uuid NOT NULL,
  pollution numeric(20,10) NOT NULL DEFAULT 0 CHECK (pollution BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id,region_id),
  FOREIGN KEY (session_id,region_id) REFERENCES session_regions(session_id,id) ON DELETE RESTRICT
);
CREATE VIEW overall_pollution AS
  SELECT r.session_id, sum(s.pollution*r.aggregation_weight)/sum(r.aggregation_weight) AS overall_pollution
  FROM session_regions r JOIN region_states s ON (s.session_id,s.region_id)=(r.session_id,r.id)
  GROUP BY r.session_id;

CREATE TABLE choice_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  situation_id uuid NOT NULL,
  choice_id uuid NOT NULL,
  request_key uuid NOT NULL,
  received_at timestamptz NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  alignment_dx smallint NOT NULL CHECK (alignment_dx BETWEEN -2 AND 2),
  alignment_dy smallint NOT NULL CHECK (alignment_dy BETWEEN -2 AND 2),
  scale_snapshot numeric(18,10) NOT NULL CHECK (scale_snapshot >= 0 AND scale_snapshot <> 'NaN'::numeric),
  -- 명시적 숫자 컬럼: JSON 대신 타입과 필수 항목을 DB에서 보장한다.
  happiness_delta_requested numeric(20,10) NOT NULL,
  happiness_delta_applied numeric(20,10) NOT NULL,
  safety_delta_requested numeric(20,10) NOT NULL,
  safety_delta_applied numeric(20,10) NOT NULL,
  cleanliness_delta_requested numeric(20,10) NOT NULL,
  cleanliness_delta_applied numeric(20,10) NOT NULL,
  state_version bigint NOT NULL CHECK (state_version > 0),
  UNIQUE (session_id,id),
  UNIQUE (session_id,participant_id,situation_id),
  UNIQUE (session_id,participant_id,request_key),
  UNIQUE (session_id,state_version),
  FOREIGN KEY (session_id,participant_id) REFERENCES participant_sessions(session_id,participant_id) ON DELETE RESTRICT,
  FOREIGN KEY (session_id,situation_id,choice_id) REFERENCES session_choices(session_id,situation_id,id) ON DELETE RESTRICT
);
CREATE INDEX choice_statistics ON choice_records(session_id,situation_id,choice_id);
CREATE INDEX choice_history ON choice_records(session_id,participant_id,received_at);
CREATE TABLE choice_record_region_effects (
  choice_record_id uuid NOT NULL,
  session_id uuid NOT NULL,
  region_id uuid NOT NULL,
  delta_requested numeric(20,10) NOT NULL,
  delta_applied numeric(20,10) NOT NULL,
  PRIMARY KEY (choice_record_id,region_id),
  FOREIGN KEY (session_id,choice_record_id) REFERENCES choice_records(session_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (session_id,region_id) REFERENCES session_regions(session_id,id) ON DELETE RESTRICT
);

CREATE TABLE session_results (
  session_id uuid PRIMARY KEY REFERENCES simulation_sessions(id) ON DELETE RESTRICT,
  finalized_at timestamptz NOT NULL,
  final_state_version bigint NOT NULL CHECK (final_state_version >= 0),
  happiness numeric(20,10) NOT NULL CHECK (happiness BETWEEN 0 AND 100),
  safety numeric(20,10) NOT NULL CHECK (safety BETWEEN 0 AND 100),
  cleanliness numeric(20,10) NOT NULL CHECK (cleanliness BETWEEN 0 AND 100),
  overall_pollution numeric(20,10) NOT NULL CHECK (overall_pollution BETWEEN 0 AND 100),
  rules_snapshot jsonb NOT NULL CHECK (jsonb_typeof(rules_snapshot) = 'object')
);
CREATE TABLE region_results (
  session_id uuid NOT NULL REFERENCES session_results(session_id) ON DELETE RESTRICT,
  region_id uuid NOT NULL,
  pollution numeric(20,10) NOT NULL CHECK (pollution BETWEEN 0 AND 100),
  PRIMARY KEY (session_id,region_id),
  FOREIGN KEY (session_id,region_id) REFERENCES session_regions(session_id,id) ON DELETE RESTRICT
);
CREATE TABLE participant_results (
  session_id uuid NOT NULL REFERENCES session_results(session_id) ON DELETE RESTRICT,
  participant_id uuid NOT NULL,
  x_score bigint NOT NULL,
  y_score bigint NOT NULL,
  response_count bigint NOT NULL CHECK (response_count >= 0),
  alignment_code text NOT NULL CHECK (alignment_code IN (
    'LAWFUL_GOOD','LAWFUL_NEUTRAL','LAWFUL_EVIL','NEUTRAL_GOOD','TRUE_NEUTRAL',
    'NEUTRAL_EVIL','CHAOTIC_GOOD','CHAOTIC_NEUTRAL','CHAOTIC_EVIL')),
  interpretation text NOT NULL,
  finalized_at timestamptz NOT NULL,
  PRIMARY KEY (session_id,participant_id),
  FOREIGN KEY (session_id,participant_id) REFERENCES participant_sessions(session_id,participant_id) ON DELETE RESTRICT,
  CHECK (response_count > 0 OR (x_score=0 AND y_score=0))
);
CREATE TABLE admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES simulation_sessions(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('CREATE','START','END')),
  request_key uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_at timestamptz,
  outcome text NOT NULL CHECK (outcome IN ('PENDING','SUCCEEDED','REJECTED','ERROR')),
  UNIQUE (admin_id,request_key)
);

-- 상태 변경 시각을 호출 코드가 빠뜨리지 않도록 DB에서 관리한다.
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER simulation_sessions_updated_at
  BEFORE UPDATE ON simulation_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 원장과 확정 결과는 일반 UPDATE/DELETE/TRUNCATE를 거부한다.
CREATE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME USING ERRCODE='55000';
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['choice_records','choice_record_region_effects',
    'session_results','region_results','participant_results'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON simus.%I FOR EACH ROW EXECUTE FUNCTION simus.reject_mutation()',t);
    EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON simus.%I FOR EACH STATEMENT EXECUTE FUNCTION simus.reject_mutation()',t);
  END LOOP;
END $$;

-- 선택지 콘텐츠는 회차 시작 뒤 고정한다. 부모 행 잠금으로 시작과 편집을 직렬화한다.
CREATE FUNCTION guard_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid; st text;
BEGIN
  IF TG_OP='UPDATE' AND NEW.session_id <> OLD.session_id THEN
    RAISE EXCEPTION 'Cannot move content between sessions';
  END IF;
  IF TG_OP='DELETE' THEN sid:=OLD.session_id; ELSE sid:=NEW.session_id; END IF;
  SELECT status INTO st FROM simus.simulation_sessions WHERE id=sid FOR UPDATE;
  IF st IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Content requires a DRAFT session'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['session_situations','session_choices','session_regions','choice_region_effects'] LOOP
    EXECUTE format('CREATE TRIGGER draft_content BEFORE INSERT OR UPDATE OR DELETE ON simus.%I FOR EACH ROW EXECUTE FUNCTION simus.guard_content()',t);
    EXECUTE format('CREATE TRIGGER no_truncate BEFORE TRUNCATE ON simus.%I FOR EACH STATEMENT EXECUTE FUNCTION simus.reject_mutation()',t);
  END LOOP;
END $$;

-- 브라우저/Unity에는 DB 자격 증명을 주지 않는다.
REVOKE ALL ON SCHEMA simus FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA simus FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA simus FROM PUBLIC;
COMMIT;
