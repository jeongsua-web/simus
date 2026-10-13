-- Upgrade sessions started before 011/the event-aware start flow was deployed.
-- Add neutral, location-independent content only; preserve authored content and scores.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10s';
-- Match the scheduler's lock order. Table locks keep the temporary trigger change
-- invisible to concurrent content writes; rollback restores triggers on failure.
LOCK TABLE simus.simulation_sessions IN ACCESS EXCLUSIVE MODE;
LOCK TABLE simus.session_situations, simus.session_choices IN ACCESS EXCLUSIVE MODE;
ALTER TABLE simus.session_situations DISABLE TRIGGER draft_content;
ALTER TABLE simus.session_choices DISABLE TRIGGER draft_content;
WITH added AS (
  INSERT INTO simus.session_situations(session_id,code,title,body,display_order,is_generic)
  SELECT s.id,'SIMUS_COMMON_ENCOUNTER_UPGRADE','이웃의 인사',
    '도시를 걷던 중 이웃이 가볍게 인사를 건넵니다. 어떻게 반응할까요?',2147483647,true
  FROM simus.simulation_sessions s
  WHERE s.status='RUNNING' AND NOT EXISTS (
    SELECT 1 FROM simus.session_situations t WHERE t.session_id=s.id
      AND t.is_generic AND t.event_location IS NULL
      AND (SELECT count(*) FROM simus.session_choices c
        WHERE c.session_id=t.session_id AND c.situation_id=t.id)>=2
  )
  RETURNING session_id,id
)
INSERT INTO simus.session_choices(session_id,situation_id,label,display_order,importance)
SELECT a.session_id,a.id,c.label,c.display_order,'NORMAL'
FROM added a CROSS JOIN (VALUES
  ('인사를 나눈다.',1),('가볍게 고개를 끄덕이고 걷는다.',2)
) AS c(label,display_order);
ALTER TABLE simus.session_situations ENABLE TRIGGER draft_content;
ALTER TABLE simus.session_choices ENABLE TRIGGER draft_content;
COMMIT;
