-- 001_initial_schema.sql 실행 후 핵심 제약조건을 검증한다.
-- 테스트 데이터는 마지막에 ROLLBACK하므로 DB에 남지 않는다.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = simus, public;

INSERT INTO admin_users (id, auth_subject, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'verify-admin', '검증 관리자');

INSERT INTO simulation_sessions (
  id, name, scheduled_end_at, admission_buffer,
  expected_participants, expected_answers_per_person, impact_scale,
  rules_snapshot, created_by_admin_id
) VALUES
  ('00000000-0000-0000-0000-000000000011', '기본 버퍼 회차', now() + interval '1 hour', interval '5 seconds',
   10, 3, 1, '{}', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000012', '변경 버퍼 회차', now() + interval '1 hour', interval '12 seconds',
   10, 3, 1, '{}', '00000000-0000-0000-0000-000000000001');

DO $$
DECLARE actual_count integer;
BEGIN
  SELECT count(*) INTO actual_count
  FROM information_schema.tables
  WHERE table_schema='simus' AND table_type='BASE TABLE';
  IF actual_count <> 18 THEN
    RAISE EXCEPTION 'Expected 18 tables, found %', actual_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM session_timing
    WHERE session_id='00000000-0000-0000-0000-000000000011'
      AND scheduled_end_at - auto_cutoff_at = interval '5 seconds'
  ) THEN
    RAISE EXCEPTION 'Default admission buffer was not applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM session_timing
    WHERE session_id='00000000-0000-0000-0000-000000000012'
      AND scheduled_end_at - auto_cutoff_at = interval '12 seconds'
  ) THEN
    RAISE EXCEPTION 'Per-session admission buffer was not applied';
  END IF;
END $$;

INSERT INTO session_situations (session_id,id,code,title,body)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000021',
  'VERIFY', '검증 상황', '복합 FK 검증'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO session_choices (session_id,situation_id,label)
    VALUES (
      '00000000-0000-0000-0000-000000000012',
      '00000000-0000-0000-0000-000000000021',
      '잘못된 회차의 선택지'
    );
    RAISE EXCEPTION 'Cross-session choice unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END $$;

INSERT INTO participants (id)
VALUES ('00000000-0000-0000-0000-000000000031');

DO $$
BEGIN
  BEGIN
    INSERT INTO participant_credentials (
      participant_id,token_hash,created_at,revoked_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000031',
      'invalid-time', now(), now() - interval '1 second'
    );
    RAISE EXCEPTION 'Invalid revoked_at unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

INSERT INTO participant_credentials (participant_id,token_hash)
VALUES ('00000000-0000-0000-0000-000000000031','valid-token-hash');

DO $$
BEGIN
  BEGIN
    DELETE FROM participants
    WHERE id='00000000-0000-0000-0000-000000000031';
    RAISE EXCEPTION 'Referenced participant unexpectedly deleted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END $$;

DO $$
DECLARE before_update timestamptz; after_update timestamptz;
BEGIN
  SELECT updated_at INTO before_update FROM simulation_sessions
  WHERE id='00000000-0000-0000-0000-000000000011';
  PERFORM pg_sleep(0.01);
  UPDATE simulation_sessions SET name='갱신 확인 회차'
  WHERE id='00000000-0000-0000-0000-000000000011';
  SELECT updated_at INTO after_update FROM simulation_sessions
  WHERE id='00000000-0000-0000-0000-000000000011';
  IF after_update <= before_update THEN
    RAISE EXCEPTION 'updated_at trigger did not advance the timestamp';
  END IF;
END $$;

ROLLBACK;
SELECT 'schema verification passed' AS result;
