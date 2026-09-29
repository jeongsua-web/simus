-- 새 스키마에 한 번만 실행하는 테스트 데이터. 실제 운영 계수가 아니다.
BEGIN;
INSERT INTO simus.admin_users(id,auth_subject,display_name) VALUES
 ('00000000-0000-0000-0000-000000000001','demo-admin-placeholder','테스트 관리자');
INSERT INTO simus.simulation_sessions(id,name,scheduled_end_at,expected_participants,expected_answers_per_person,impact_scale,created_by_admin_id)
VALUES('10000000-0000-0000-0000-000000000001','연결 테스트 1회차',clock_timestamp()+interval '1 day',20,1,0.1,'00000000-0000-0000-0000-000000000001');
INSERT INTO simus.session_regions(session_id,id,code,name) VALUES
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','PLAZA','중앙 광장');
INSERT INTO simus.session_situations(session_id,id,code,title,body) VALUES
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','WASTE','광장의 쓰레기','분리배출함 옆에 쓰레기가 흩어져 있습니다. 어떻게 행동할까요?');
INSERT INTO simus.session_choices(session_id,situation_id,id,label,importance,alignment_dx,alignment_dy,happiness_base,cleanliness_base,display_order) VALUES
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','공동 분리배출 규칙에 맞춰 쓰레기를 정리한다.','NORMAL',1,1,3,5,1),
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','쓰레기를 건드리지 않고 지나간다.','NORMAL',0,0,0,0,2);
INSERT INTO simus.choice_region_effects VALUES
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',-5);
INSERT INTO simus.city_states(session_id) VALUES('10000000-0000-0000-0000-000000000001');
INSERT INTO simus.region_states(session_id,region_id) SELECT session_id,id FROM simus.session_regions;
INSERT INTO simus.participants(id) VALUES
 ('50000000-0000-0000-0000-000000000001'),('50000000-0000-0000-0000-000000000002');
INSERT INTO simus.participant_sessions(session_id,participant_id)
 SELECT '10000000-0000-0000-0000-000000000001'::uuid,id FROM simus.participants;
INSERT INTO simus.participant_alignments(session_id,participant_id) SELECT session_id,participant_id FROM simus.participant_sessions;
-- 의도적으로 DRAFT 유지. 인증 토큰과 관리자 로그인은 생성하지 않는다.
COMMIT;
