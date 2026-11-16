-- Invoked only by scripts/dev/v003-local.mjs after fresh managed init + original seeds.
-- Original situation/choice UUIDs, text, order, scores, and region effects are preserved.
BEGIN;
SELECT id FROM simus.simulation_sessions WHERE id='16000000-0000-0000-0000-000000000001' FOR UPDATE;
DO $$ BEGIN
 IF current_database()<>'simus_v003_local' THEN RAISE EXCEPTION 'Disposable v003 local database required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM simus.simulation_sessions WHERE id='16000000-0000-0000-0000-000000000001' AND status='DRAFT')
 OR EXISTS(SELECT 1 FROM simus.participant_sessions) THEN RAISE EXCEPTION 'Unjoined DRAFT required'; END IF;
 IF current_setting('simus.v003_motion')::jsonb->>'map_version'<>'city-masterplan-v003-local-v1'
 OR current_setting('simus.v003_motion')::jsonb->>'path_version'<>'city-masterplan-v003-plaza30-v1' THEN RAISE EXCEPTION 'v003 version mismatch'; END IF;
END $$;
UPDATE simus.simulation_sessions SET name='v003 광장 EXHIBITION_30 로컬 테스트', scheduled_end_at=clock_timestamp()+interval '12 hours',
 npc_motion=current_setting('simus.v003_motion')::jsonb WHERE id='16000000-0000-0000-0000-000000000001';
UPDATE simus.session_regions SET map_metadata='{}'::jsonb WHERE session_id='16000000-0000-0000-0000-000000000001';
UPDATE simus.session_situations SET event_location=current_setting('simus.v003_location')::jsonb
 WHERE session_id='16000000-0000-0000-0000-000000000001' AND code='EXHIBITION_30';
COMMIT;
