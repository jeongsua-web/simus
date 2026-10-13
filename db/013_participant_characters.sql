-- Apply once after 012. Existing citizens use character 01.
BEGIN;
ALTER TABLE simus.participant_sessions ADD COLUMN character_id text NOT NULL DEFAULT 'npc_01'
  CHECK (character_id ~ '^npc_(0[1-9]|1[0-6])$');
CREATE OR REPLACE FUNCTION simus.guard_profile_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.profile_completed_at IS NOT NULL AND ROW(NEW.nickname,NEW.mbti,NEW.department_id,NEW.profile_completed_at,NEW.character_id)
    IS DISTINCT FROM ROW(OLD.nickname,OLD.mbti,OLD.department_id,OLD.profile_completed_at,OLD.character_id) THEN
    RAISE EXCEPTION 'Participant profile is locked' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
COMMIT;
