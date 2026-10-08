-- Apply once after 008. Existing memberships keep a NULL profile and complete it on next entry.
BEGIN;
SET LOCAL search_path = simus, public;
ALTER TABLE participant_sessions
  ADD COLUMN nickname text,
  ADD COLUMN mbti text,
  ADD COLUMN profile_completed_at timestamptz,
  ADD CONSTRAINT profile_all_or_nothing CHECK (
    (nickname IS NULL AND mbti IS NULL AND profile_completed_at IS NULL)
    OR (nickname IS NOT NULL AND mbti IS NOT NULL AND profile_completed_at IS NOT NULL AND department_id <> 'none')),
  ADD CONSTRAINT profile_nickname_shape CHECK (
    nickname IS NULL OR (char_length(nickname) BETWEEN 2 AND 10 AND nickname = btrim(nickname))),
  ADD CONSTRAINT profile_mbti_shape CHECK (mbti IS NULL OR mbti ~ '^[EI][SN][TF][JP]$');
-- Completion order inside a session is the citizen number; the row lock serializes completion.
CREATE INDEX participant_profile_order ON participant_sessions(session_id, profile_completed_at)
  WHERE profile_completed_at IS NOT NULL;
CREATE FUNCTION guard_profile_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.profile_completed_at IS NOT NULL AND ROW(NEW.nickname,NEW.mbti,NEW.department_id,NEW.profile_completed_at)
    IS DISTINCT FROM ROW(OLD.nickname,OLD.mbti,OLD.department_id,OLD.profile_completed_at) THEN
    RAISE EXCEPTION 'Participant profile is locked' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profile_change BEFORE UPDATE ON participant_sessions
  FOR EACH ROW EXECUTE FUNCTION guard_profile_change();
REVOKE EXECUTE ON FUNCTION guard_profile_change() FROM PUBLIC;
COMMIT;
