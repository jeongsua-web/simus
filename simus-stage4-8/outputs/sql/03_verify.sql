-- 01, 02 실행 후 테스트 DB에서 실행. 모든 테스트 변경은 마지막에 롤백한다.
BEGIN;
DO $$
DECLARE
 s uuid := '10000000-0000-0000-0000-000000000001';
 p uuid := '50000000-0000-0000-0000-000000000001';
 q uuid := '30000000-0000-0000-0000-000000000001';
 c uuid := '40000000-0000-0000-0000-000000000001';
 r uuid := gen_random_uuid();
 x integer; y integer; n integer;
BEGIN
 SELECT count(*) INTO n FROM simus.participant_alignments WHERE x_score=0 AND y_score=0 AND response_count=0;
 IF n <> 2 THEN RAISE EXCEPTION 'initial participant scores'; END IF;
 IF NOT EXISTS (SELECT 1 FROM simus.current_city WHERE session_id=s AND happiness=50 AND safety=50 AND cleanliness=50 AND overall_pollution=0) THEN
 RAISE EXCEPTION 'initial city'; END IF;
 FOR x IN -3..3 LOOP
 FOR y IN -3..3 LOOP
 IF simus.classify_alignment(x,y) <> (CASE
 WHEN abs(x)<=2 AND abs(y)<=2 THEN 'TRUE_NEUTRAL'
 ELSE (CASE WHEN x< -2 THEN 'CHAOTIC' WHEN x>2 THEN 'LAWFUL' ELSE 'NEUTRAL' END)||'_'||
 (CASE WHEN y< -2 THEN 'EVIL' WHEN y>2 THEN 'GOOD' ELSE 'NEUTRAL' END) END) THEN
 RAISE EXCEPTION 'alignment boundary'; END IF;
 END LOOP; END LOOP;
 SELECT count(DISTINCT simus.classify_alignment(a,b)) INTO n
 FROM unnest(ARRAY[-3,0,3]) a CROSS JOIN unnest(ARRAY[-3,0,3]) b;
 IF n<>9 THEN RAISE EXCEPTION 'nine alignments'; END IF;
 INSERT INTO simus.choice_records(session_id,participant_id,situation_id,choice_id,request_key,received_at,
 alignment_dx,alignment_dy,scale_snapshot,happiness_requested,safety_requested,cleanliness_requested,
 happiness_applied,safety_applied,cleanliness_applied,state_version)
 VALUES(s,p,q,c,r,clock_timestamp(),1,1,0.1,0.3,0,0.5,0.3,0,0.5,1);
 BEGIN
 INSERT INTO simus.choice_records SELECT gen_random_uuid(), session_id,participant_id,situation_id,choice_id,
 gen_random_uuid(),received_at,applied_at,alignment_dx,alignment_dy,scale_snapshot,
 happiness_requested,safety_requested,cleanliness_requested,happiness_applied,safety_applied,cleanliness_applied,2
 FROM simus.choice_records WHERE request_key=r;
 RAISE EXCEPTION 'duplicate accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
 UPDATE simus.choice_records SET alignment_dx=0 WHERE request_key=r;
 RAISE EXCEPTION USING ERRCODE='XX000',MESSAGE='immutable record changed';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN
 INSERT INTO simus.choice_region_effects VALUES(s,q,gen_random_uuid(),'20000000-0000-0000-0000-000000000001',1);
 RAISE EXCEPTION 'invalid choice accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN
 UPDATE simus.city_states SET happiness=101 WHERE session_id=s;
 RAISE EXCEPTION 'out of range accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 -- 하위 트랜잭션 실패 시 앞선 변경도 롤백되는지 확인한다.
 BEGIN
 UPDATE simus.participant_alignments SET x_score=99 WHERE session_id=s AND participant_id=p;
 UPDATE simus.city_states SET safety=-1 WHERE session_id=s;
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF EXISTS(SELECT 1 FROM simus.participant_alignments WHERE x_score=99) THEN RAISE EXCEPTION 'rollback failed'; END IF;
 UPDATE simus.simulation_sessions SET status='RUNNING',starts_at=clock_timestamp() WHERE id=s;
 BEGIN
 INSERT INTO simus.simulation_sessions(name,status,starts_at,scheduled_end_at,expected_participants,expected_answers_per_person,impact_scale,created_by_admin_id)
 VALUES('동시 회차','RUNNING',clock_timestamp(),clock_timestamp()+interval '1 hour',1,1,1,'00000000-0000-0000-0000-000000000001');
 RAISE EXCEPTION 'multiple running sessions accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 RAISE NOTICE 'PASS: initial state, alignment boundaries / 9 classes, duplicate response, immutable record, invalid FK, stat range, rollback, one active session';
END $$;
ROLLBACK;
