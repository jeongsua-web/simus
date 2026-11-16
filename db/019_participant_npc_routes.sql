-- Preserve existing snapshots. New v002 members may use different graph routes.
BEGIN;
CREATE OR REPLACE FUNCTION simus.guard_new_npc_motion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE configured_motion jsonb;
BEGIN
  SELECT npc_motion INTO configured_motion FROM simus.simulation_sessions
    WHERE id=NEW.session_id FOR UPDATE;
  IF configured_motion IS NULL THEN
    RAISE EXCEPTION 'NPC_MOTION_NOT_CONFIGURED' USING ERRCODE='23514';
  END IF;
  IF NEW.npc_motion IS DISTINCT FROM configured_motion THEN
    IF (configured_motion->>'map_version') NOT IN ('test-only-city-rebuild-v002-webgl-v1', 'test-only-city-rebuild-v002-phase1-v1')
      OR configured_motion->>'loop' IS DISTINCT FROM 'true'
      OR (NEW.npc_motion - 'points') IS DISTINCT FROM (configured_motion - 'points')
      OR simus.valid_npc_motion(NEW.npc_motion) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'NPC motion must match the session configuration' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
-- npc_identity still prevents changing any joined participant's route.
REVOKE EXECUTE ON FUNCTION simus.guard_new_npc_motion() FROM PUBLIC;
COMMIT;
