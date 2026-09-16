-- Apply once after 001_initial_schema.sql. No existing rows are rewritten or removed.
BEGIN;
SET LOCAL search_path = simus, public;

CREATE FUNCTION guard_session_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'New sessions must be DRAFT' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.id <> OLD.id OR NEW.created_by_admin_id <> OLD.created_by_admin_id THEN
    RAISE EXCEPTION 'Session identity is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
    (OLD.status='DRAFT' AND NEW.status='RUNNING') OR
    (OLD.status='RUNNING' AND NEW.status='CLOSING') OR
    (OLD.status='CLOSING' AND NEW.status='FINALIZED')) THEN
    RAISE EXCEPTION 'Invalid session transition: % -> %', OLD.status, NEW.status USING ERRCODE='23514';
  END IF;
  IF (OLD.status <> 'DRAFT' AND
    ROW(NEW.name,NEW.starts_at,NEW.scheduled_end_at,NEW.admission_buffer,
        NEW.expected_participants,NEW.expected_answers_per_person,NEW.impact_scale,
        NEW.rules_snapshot,NEW.pollution_aggregation)
    IS DISTINCT FROM
    ROW(OLD.name,OLD.starts_at,OLD.scheduled_end_at,OLD.admission_buffer,
        OLD.expected_participants,OLD.expected_answers_per_person,OLD.impact_scale,
        OLD.rules_snapshot,OLD.pollution_aggregation)) OR
    (OLD.status='DRAFT' AND NEW.status<>'DRAFT' AND
      ROW(NEW.name,NEW.scheduled_end_at,NEW.admission_buffer,NEW.expected_participants,
          NEW.expected_answers_per_person,NEW.impact_scale,NEW.rules_snapshot,NEW.pollution_aggregation)
      IS DISTINCT FROM
      ROW(OLD.name,OLD.scheduled_end_at,OLD.admission_buffer,OLD.expected_participants,
          OLD.expected_answers_per_person,OLD.impact_scale,OLD.rules_snapshot,OLD.pollution_aggregation)) THEN
    RAISE EXCEPTION 'Started session configuration is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.admission_closed_at IS NOT NULL AND
    (NEW.admission_closed_at IS NULL OR NEW.admission_closed_at > OLD.admission_closed_at) THEN
    RAISE EXCEPTION 'Admission cannot reopen' USING ERRCODE='23514';
  END IF;
  IF OLD.status IN ('CLOSING','FINALIZED') AND
    ROW(NEW.end_mode,NEW.ended_by_admin_id,NEW.end_requested_at,NEW.admission_closed_at)
    IS DISTINCT FROM ROW(OLD.end_mode,OLD.ended_by_admin_id,OLD.end_requested_at,OLD.admission_closed_at) THEN
    RAISE EXCEPTION 'Closing metadata is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.status='FINALIZED' AND
    ROW(NEW.actual_ended_at,NEW.finalized_at) IS DISTINCT FROM ROW(OLD.actual_ended_at,OLD.finalized_at) THEN
    RAISE EXCEPTION 'Finalization timestamps are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.status='RUNNING' AND OLD.status='DRAFT' THEN
    IF NOT EXISTS (SELECT 1 FROM simus.city_states WHERE session_id=NEW.id AND version=0)
      OR NOT EXISTS (SELECT 1 FROM simus.session_regions WHERE session_id=NEW.id)
      OR EXISTS (SELECT 1 FROM simus.session_regions r WHERE r.session_id=NEW.id AND NOT EXISTS
        (SELECT 1 FROM simus.region_states s WHERE s.session_id=r.session_id AND s.region_id=r.id))
      OR NOT EXISTS (SELECT 1 FROM simus.session_situations WHERE session_id=NEW.id)
      OR EXISTS (SELECT 1 FROM simus.session_situations t WHERE t.session_id=NEW.id AND
        (SELECT count(*) FROM simus.session_choices c WHERE c.session_id=t.session_id AND c.situation_id=t.id)<2)
      OR EXISTS (SELECT 1 FROM simus.choice_records WHERE session_id=NEW.id) THEN
      RAISE EXCEPTION 'Session is not ready to start' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.status='FINALIZED' AND OLD.status='CLOSING' THEN
    IF NOT EXISTS (SELECT 1 FROM simus.session_results r JOIN simus.city_states c USING(session_id)
      WHERE r.session_id=NEW.id AND r.finalized_at=NEW.finalized_at AND r.final_state_version=c.version
        AND r.rules_snapshot=NEW.rules_snapshot)
      OR (SELECT count(*) FROM simus.region_results WHERE session_id=NEW.id)
        <> (SELECT count(*) FROM simus.session_regions WHERE session_id=NEW.id)
      OR EXISTS (SELECT 1 FROM simus.participant_sessions p
        LEFT JOIN simus.participant_alignments a USING(session_id,participant_id)
        LEFT JOIN simus.participant_results r USING(session_id,participant_id)
        WHERE p.session_id=NEW.id AND (a.participant_id IS NULL OR
          ((a.response_count>0 OR NEW.rules_snapshot->>'zero_response_policy'='INCLUDE')
            AND (r.participant_id IS NULL OR r.finalized_at<>NEW.finalized_at
              OR ROW(r.x_score,r.y_score,r.response_count) IS DISTINCT FROM ROW(a.x_score,a.y_score,a.response_count)))))
      OR (SELECT count(*) FROM simus.participant_results WHERE session_id=NEW.id)
        <> (SELECT count(*) FROM simus.participant_alignments WHERE session_id=NEW.id
          AND (response_count>0 OR NEW.rules_snapshot->>'zero_response_policy'='INCLUDE')) THEN
      RAISE EXCEPTION 'Complete results are required before FINALIZED' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER session_lifecycle BEFORE INSERT OR UPDATE ON simulation_sessions
  FOR EACH ROW EXECUTE FUNCTION guard_session_lifecycle();

-- Every writer takes the same parent lock as the selection and lifecycle APIs.
CREATE FUNCTION guard_session_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid; st text;
BEGIN
  IF TG_OP='UPDATE' AND NEW.session_id<>OLD.session_id THEN
    RAISE EXCEPTION 'Cannot move state between sessions' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN sid:=OLD.session_id; ELSE sid:=NEW.session_id; END IF;
  SELECT status INTO st FROM simus.simulation_sessions WHERE id=sid FOR UPDATE;
  IF TG_ARGV[0]='result' THEN
    IF st IS DISTINCT FROM 'CLOSING' THEN
      RAISE EXCEPTION 'Results require CLOSING' USING ERRCODE='23514';
    END IF;
  ELSIF TG_ARGV[0]='ledger' THEN
    IF st IS DISTINCT FROM 'RUNNING' THEN
      RAISE EXCEPTION 'Choices require RUNNING' USING ERRCODE='23514';
    END IF;
  ELSIF st IS NULL OR st NOT IN ('DRAFT','RUNNING') OR (TG_OP='DELETE' AND st<>'DRAFT') THEN
    RAISE EXCEPTION 'State is closed for writes' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['city_states','region_states','participant_sessions','participant_alignments'] LOOP
    EXECUTE format('CREATE TRIGGER lifecycle_write BEFORE INSERT OR UPDATE OR DELETE ON simus.%I FOR EACH ROW EXECUTE FUNCTION simus.guard_session_write(''state'')',t);
    EXECUTE format('CREATE TRIGGER lifecycle_no_truncate BEFORE TRUNCATE ON simus.%I FOR EACH STATEMENT EXECUTE FUNCTION simus.reject_mutation()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['choice_records','choice_record_region_effects'] LOOP
    EXECUTE format('CREATE TRIGGER lifecycle_insert BEFORE INSERT ON simus.%I FOR EACH ROW EXECUTE FUNCTION simus.guard_session_write(''ledger'')',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['session_results','region_results','participant_results'] LOOP
    EXECUTE format('CREATE TRIGGER lifecycle_insert BEFORE INSERT ON simus.%I FOR EACH ROW EXECUTE FUNCTION simus.guard_session_write(''result'')',t);
  END LOOP;
END $$;

-- Even direct SQL cannot commit half of a result set in CLOSING.
CREATE FUNCTION require_finalized_results() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM simus.simulation_sessions WHERE id=NEW.session_id AND status='FINALIZED') THEN
    RAISE EXCEPTION 'Result inserts and FINALIZED must commit together' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['session_results','region_results','participant_results'] LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER results_commit AFTER INSERT ON simus.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simus.require_finalized_results()',t);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION guard_session_lifecycle(), guard_session_write(), require_finalized_results() FROM PUBLIC;
COMMIT;
