-- Apply once after 013. Preserve previously issued character appearances.
BEGIN;
ALTER TABLE simus.participant_sessions ADD COLUMN glasses_id text NOT NULL DEFAULT 'none'
  CHECK (glasses_id IN ('none','square','round'));
-- Temporarily extend the existing guard only after backfilling the new column.
UPDATE simus.participant_sessions SET glasses_id=CASE character_id
  WHEN 'npc_01' THEN 'square' WHEN 'npc_04' THEN 'round' ELSE 'none' END;
CREATE OR REPLACE FUNCTION simus.guard_profile_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.profile_completed_at IS NOT NULL AND ROW(NEW.nickname,NEW.mbti,NEW.department_id,NEW.profile_completed_at,NEW.character_id,NEW.glasses_id)
    IS DISTINCT FROM ROW(OLD.nickname,OLD.mbti,OLD.department_id,OLD.profile_completed_at,OLD.character_id,OLD.glasses_id) THEN
    RAISE EXCEPTION 'Participant profile is locked' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
COMMIT;
