-- SIM:US 연결 시제품 / PostgreSQL
-- 새 DB에서 한 번 실행한다. 기존 테이블을 삭제하거나 덮어쓰지 않는다.
BEGIN;
CREATE SCHEMA simus;

CREATE TABLE simus.admin_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 auth_subject text NOT NULL UNIQUE,
 display_name text NOT NULL,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE simus.simulation_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT'
   CHECK (status IN ('DRAFT','RUNNING','CLOSING','FINALIZED')),
 starts_at timestamptz,
 scheduled_end_at timestamptz NOT NULL,
 -- 입력 마감은 scheduled_end_at - interval '5 seconds'로 계산한다.
 end_requested_at timestamptz,
 actual_ended_at timestamptz,
 finalized_at timestamptz,
 end_mode text CHECK (end_mode IN ('AUTO','MANUAL')),
 ended_by_admin_id uuid REFERENCES simus.admin_users(id),
 expected_participants integer NOT NULL CHECK (expected_participants > 0),
 expected_answers_per_person integer NOT NULL CHECK (expected_answers_per_person > 0),
 impact_scale numeric(18,10) NOT NULL CHECK (impact_scale >= 0),
 rules_snapshot jsonb NOT NULL DEFAULT
   '{"alignment_negative_max":-3,"alignment_positive_min":3,"pollution_aggregation":"weighted_mean","reset_each_session":true}'::jsonb,
 created_by_admin_id uuid NOT NULL REFERENCES simus.admin_users(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (starts_at IS NULL OR scheduled_end_at > starts_at + interval '5 seconds'),
 CHECK ((end_mode IS NULL AND ended_by_admin_id IS NULL)
     OR (end_mode = 'AUTO' AND ended_by_admin_id IS NULL)
     OR (end_mode = 'MANUAL' AND ended_by_admin_id IS NOT NULL)),
 CHECK (status = 'DRAFT' OR starts_at IS NOT NULL),
 CHECK (status NOT IN ('CLOSING','FINALIZED') OR
   (end_mode IS NOT NULL AND end_requested_at IS NOT NULL AND actual_ended_at IS NOT NULL)),
 CHECK ((status = 'FINALIZED') = (finalized_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_active_session ON simus.simulation_sessions ((true))
 WHERE status IN ('RUNNING','CLOSING');

CREATE TABLE simus.participants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE simus.participant_credentials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 participant_id uuid NOT NULL REFERENCES simus.participants(id),
 token_hash text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz,
 revoked_at timestamptz,
 CHECK (expires_at IS NULL OR expires_at > created_at)
);
CREATE TABLE simus.participant_sessions (
 session_id uuid NOT NULL REFERENCES simus.simulation_sessions(id),
 participant_id uuid NOT NULL REFERENCES simus.participants(id),
 joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (session_id, participant_id)
);
CREATE INDEX participant_history ON simus.participant_sessions(participant_id, joined_at DESC);

CREATE TABLE simus.session_situations (
 session_id uuid NOT NULL REFERENCES simus.simulation_sessions(id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 code text NOT NULL,
 title text NOT NULL,
 body text NOT NULL,
 display_order integer NOT NULL DEFAULT 0,
 PRIMARY KEY (session_id,id),
 UNIQUE (session_id,code)
);
CREATE TABLE simus.session_choices (
 session_id uuid NOT NULL,
 situation_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 label text NOT NULL,
 display_order integer NOT NULL DEFAULT 0,
 importance text NOT NULL CHECK (importance IN ('NORMAL','MAJOR')),
 alignment_dx smallint NOT NULL DEFAULT 0,
 alignment_dy smallint NOT NULL DEFAULT 0,
 happiness_base numeric(20,10) NOT NULL DEFAULT 0,
 safety_base numeric(20,10) NOT NULL DEFAULT 0,
 cleanliness_base numeric(20,10) NOT NULL DEFAULT 0,
 PRIMARY KEY(session_id,situation_id,id),
 FOREIGN KEY(session_id,situation_id) REFERENCES simus.session_situations(session_id,id),
 CHECK ((importance='NORMAL' AND alignment_dx BETWEEN -1 AND 1 AND alignment_dy BETWEEN -1 AND 1)
     OR (importance='MAJOR' AND alignment_dx BETWEEN -2 AND 2 AND alignment_dy BETWEEN -2 AND 2))
);
CREATE TABLE simus.session_regions (
 session_id uuid NOT NULL REFERENCES simus.simulation_sessions(id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 code text NOT NULL,
 name text NOT NULL,
 aggregation_weight numeric(20,10) NOT NULL DEFAULT 1 CHECK (aggregation_weight > 0),
 PRIMARY KEY(session_id,id),
 UNIQUE(session_id,code)
);
CREATE TABLE simus.choice_region_effects (
 session_id uuid NOT NULL,
 situation_id uuid NOT NULL,
 choice_id uuid NOT NULL,
 region_id uuid NOT NULL,
 pollution_base numeric(20,10) NOT NULL,
 PRIMARY KEY(session_id,situation_id,choice_id,region_id),
 FOREIGN KEY(session_id,situation_id,choice_id) REFERENCES simus.session_choices(session_id,situation_id,id),
 FOREIGN KEY(session_id,region_id) REFERENCES simus.session_regions(session_id,id)
);
CREATE TABLE simus.participant_alignments (
 session_id uuid NOT NULL,
 participant_id uuid NOT NULL,
 x_score bigint NOT NULL DEFAULT 0,
 y_score bigint NOT NULL DEFAULT 0,
 response_count bigint NOT NULL DEFAULT 0 CHECK(response_count >= 0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,participant_id),
 FOREIGN KEY(session_id,participant_id) REFERENCES simus.participant_sessions(session_id,participant_id)
);
CREATE TABLE simus.city_states (
 session_id uuid PRIMARY KEY REFERENCES simus.simulation_sessions(id),
 happiness numeric(20,10) NOT NULL DEFAULT 50 CHECK(happiness BETWEEN 0 AND 100),
 safety numeric(20,10) NOT NULL DEFAULT 50 CHECK(safety BETWEEN 0 AND 100),
 cleanliness numeric(20,10) NOT NULL DEFAULT 50 CHECK(cleanliness BETWEEN 0 AND 100),
 version bigint NOT NULL DEFAULT 0 CHECK(version >= 0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE simus.region_states (
 session_id uuid NOT NULL,
 region_id uuid NOT NULL,
 pollution numeric(20,10) NOT NULL DEFAULT 0 CHECK(pollution BETWEEN 0 AND 100),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,region_id),
 FOREIGN KEY(session_id,region_id) REFERENCES simus.session_regions(session_id,id)
);
CREATE TABLE simus.choice_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL,
 participant_id uuid NOT NULL,
 situation_id uuid NOT NULL,
 choice_id uuid NOT NULL,
 request_key uuid NOT NULL,
 received_at timestamptz NOT NULL,
 applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 alignment_dx smallint NOT NULL CHECK(alignment_dx BETWEEN -2 AND 2),
 alignment_dy smallint NOT NULL CHECK(alignment_dy BETWEEN -2 AND 2),
 scale_snapshot numeric(18,10) NOT NULL CHECK(scale_snapshot >= 0),
 happiness_requested numeric(20,10) NOT NULL,
 safety_requested numeric(20,10) NOT NULL,
 cleanliness_requested numeric(20,10) NOT NULL,
 happiness_applied numeric(20,10) NOT NULL,
 safety_applied numeric(20,10) NOT NULL,
 cleanliness_applied numeric(20,10) NOT NULL,
 state_version bigint NOT NULL CHECK(state_version > 0),
 UNIQUE(session_id,id),
 UNIQUE(session_id,participant_id,situation_id),
 UNIQUE(session_id,participant_id,request_key),
 UNIQUE(session_id,state_version),
 FOREIGN KEY(session_id,participant_id) REFERENCES simus.participant_sessions(session_id,participant_id),
 FOREIGN KEY(session_id,situation_id,choice_id) REFERENCES simus.session_choices(session_id,situation_id,id)
);
CREATE INDEX choice_statistics ON simus.choice_records(session_id,situation_id,choice_id);
CREATE INDEX choice_history ON simus.choice_records(session_id,participant_id,received_at);
CREATE TABLE simus.choice_record_region_effects (
 choice_record_id uuid NOT NULL,
 session_id uuid NOT NULL,
 region_id uuid NOT NULL,
 delta_requested numeric(20,10) NOT NULL,
 delta_applied numeric(20,10) NOT NULL,
 PRIMARY KEY(choice_record_id,region_id),
 FOREIGN KEY(session_id,choice_record_id) REFERENCES simus.choice_records(session_id,id),
 FOREIGN KEY(session_id,region_id) REFERENCES simus.session_regions(session_id,id)
);

CREATE FUNCTION simus.classify_alignment(x bigint, y bigint) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT CASE WHEN x BETWEEN -2 AND 2 AND y BETWEEN -2 AND 2 THEN 'TRUE_NEUTRAL'
 ELSE (CASE WHEN x <= -3 THEN 'CHAOTIC' WHEN x >= 3 THEN 'LAWFUL' ELSE 'NEUTRAL' END)
 || '_' || (CASE WHEN y <= -3 THEN 'EVIL' WHEN y >= 3 THEN 'GOOD' ELSE 'NEUTRAL' END) END
$$;
CREATE TABLE simus.session_results (
 session_id uuid PRIMARY KEY REFERENCES simus.simulation_sessions(id),
 finalized_at timestamptz NOT NULL,
 final_state_version bigint NOT NULL CHECK(final_state_version >= 0),
 happiness numeric(20,10) NOT NULL CHECK(happiness BETWEEN 0 AND 100),
 safety numeric(20,10) NOT NULL CHECK(safety BETWEEN 0 AND 100),
 cleanliness numeric(20,10) NOT NULL CHECK(cleanliness BETWEEN 0 AND 100),
 overall_pollution numeric(20,10) NOT NULL CHECK(overall_pollution BETWEEN 0 AND 100),
 rules_snapshot jsonb NOT NULL
);
CREATE TABLE simus.region_results (
 session_id uuid NOT NULL REFERENCES simus.session_results(session_id),
 region_id uuid NOT NULL,
 pollution numeric(20,10) NOT NULL CHECK(pollution BETWEEN 0 AND 100),
 PRIMARY KEY(session_id,region_id),
 FOREIGN KEY(session_id,region_id) REFERENCES simus.session_regions(session_id,id)
);
CREATE TABLE simus.participant_results (
 session_id uuid NOT NULL REFERENCES simus.session_results(session_id),
 participant_id uuid NOT NULL,
 x_score bigint NOT NULL,
 y_score bigint NOT NULL,
 response_count bigint NOT NULL CHECK(response_count >= 0),
 alignment_code text GENERATED ALWAYS AS (simus.classify_alignment(x_score,y_score)) STORED,
 interpretation text NOT NULL,
 finalized_at timestamptz NOT NULL,
 PRIMARY KEY(session_id,participant_id),
 FOREIGN KEY(session_id,participant_id) REFERENCES simus.participant_sessions(session_id,participant_id),
 CHECK(response_count > 0 OR (x_score=0 AND y_score=0))
);

-- 성공 원장과 최종 결과는 일반 UPDATE / DELETE로 수정하지 않는다.
CREATE FUNCTION simus.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['choice_records','choice_record_region_effects','session_results','region_results','participant_results'] LOOP
 EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON simus.%I FOR EACH ROW EXECUTE FUNCTION simus.reject_mutation()',t);
 END LOOP;
END $$;

CREATE VIEW simus.current_city AS
 SELECT c.*, s.status, s.scheduled_end_at,
 s.scheduled_end_at - interval '5 seconds' AS auto_cutoff_at,
 (SELECT sum(rs.pollution*r.aggregation_weight)/NULLIF(sum(r.aggregation_weight),0)
  FROM simus.region_states rs JOIN simus.session_regions r
    ON (r.session_id=rs.session_id AND r.id=rs.region_id)
  WHERE rs.session_id=c.session_id) AS overall_pollution
 FROM simus.city_states c JOIN simus.simulation_sessions s ON s.id=c.session_id;

-- 접근 권한은 서버 전용 역할에 별도로 부여한다.
REVOKE ALL ON SCHEMA simus FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA simus FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA simus FROM PUBLIC;
COMMIT;
