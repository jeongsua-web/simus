-- Apply once after 003. Existing memberships/results are preserved.
BEGIN;
SET LOCAL search_path = simus, public;
ALTER TABLE participant_sessions
  ADD COLUMN npc_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN npc_motion jsonb NOT NULL DEFAULT '{"map_version":"neighborhood-v1","path_version":"walkway-v1","points":[[-64,1.4,12],[-64,1.4,45]],"speed_mps":1.4,"loop":true}'::jsonb;
-- The first route uses the existing Unity preview walkway, including its return leg.
CREATE FUNCTION guard_npc_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.session_id,NEW.participant_id,NEW.joined_at,NEW.npc_id,NEW.npc_motion)
    IS DISTINCT FROM ROW(OLD.session_id,OLD.participant_id,OLD.joined_at,OLD.npc_id,OLD.npc_motion) THEN
    RAISE EXCEPTION 'NPC identity and motion snapshot are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER npc_identity BEFORE UPDATE ON participant_sessions
  FOR EACH ROW EXECUTE FUNCTION guard_npc_identity();
REVOKE EXECUTE ON FUNCTION guard_npc_identity() FROM PUBLIC;
COMMIT;
