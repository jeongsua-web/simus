-- Managed replacement for unapplied 014; run BEFORE 015 where necessary.
-- No transaction wrapper: scripts/db/migrate.py owns the entire transaction.
-- Lock parents first, matching lifecycle writers. Never change existing glasses.
LOCK TABLE simus.simulation_sessions IN ACCESS EXCLUSIVE MODE;
LOCK TABLE simus.participant_sessions IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE guard record;
BEGIN
  FOR guard IN SELECT * FROM (VALUES
    ('lifecycle_write','simus.guard_session_write()'),
    ('profile_change','simus.guard_profile_change()'),
    ('npc_identity','simus.guard_npc_identity()'),
    ('department_change','simus.guard_department_change()'),
    ('npc_motion_snapshot','simus.guard_new_npc_motion()')
  ) AS expected(name,function_name) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
      WHERE tgrelid='simus.participant_sessions'::regclass
        AND tgname=guard.name AND tgenabled='O'
        AND tgfoid=to_regprocedure(guard.function_name)) THEN
      RAISE EXCEPTION 'Missing, disabled or unexpected membership guard: %', guard.name;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid='simus.participant_sessions'::regclass
      AND attname='glasses_id' AND NOT attisdropped) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
      WHERE tgrelid='simus.participant_sessions'::regclass
        AND tgname='lifecycle_write' AND tgenabled='O'
        AND tgfoid='simus.guard_session_write()'::regprocedure) THEN
      RAISE EXCEPTION 'Expected enabled lifecycle_write trigger; manual review required';
    END IF;
    ALTER TABLE simus.participant_sessions ADD COLUMN glasses_id text NOT NULL DEFAULT 'none'
      CONSTRAINT participant_glasses_allowed CHECK (glasses_id IN ('none','square','round'));
    -- Closed memberships reject every UPDATE through lifecycle_write. Hold both
    -- locks while bypassing ONLY that guard for this new-column backfill.
    -- Transaction rollback restores the column, rows and trigger on any failure.
    ALTER TABLE simus.participant_sessions DISABLE TRIGGER lifecycle_write;
    UPDATE simus.participant_sessions SET glasses_id=CASE character_id
      WHEN 'npc_01' THEN 'square' WHEN 'npc_04' THEN 'round' ELSE 'none' END
      WHERE character_id IN ('npc_01','npc_04');
    ALTER TABLE simus.participant_sessions ENABLE TRIGGER lifecycle_write;
  ELSE
    -- 014 already present: no UPDATE, default change or appearance inference.
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid='simus.participant_sessions'::regclass AND attname='glasses_id'
        AND atttypid='text'::regtype AND attnotnull AND NOT attisdropped)
      OR EXISTS (SELECT 1 FROM simus.participant_sessions
        WHERE glasses_id IS NULL OR glasses_id NOT IN ('none','square','round')) THEN
      RAISE EXCEPTION 'Unexpected existing glasses column; manual review required';
    END IF;
    -- Ensure the same future-domain guarantee without rewriting values.
    ALTER TABLE simus.participant_sessions ADD CONSTRAINT participant_glasses_safe_domain
      CHECK (glasses_id IN ('none','square','round'));
  END IF;
END $$;
CREATE OR REPLACE FUNCTION simus.guard_profile_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.profile_completed_at IS NOT NULL AND ROW(NEW.nickname,NEW.mbti,NEW.department_id,NEW.profile_completed_at,NEW.character_id,NEW.glasses_id)
    IS DISTINCT FROM ROW(OLD.nickname,OLD.mbti,OLD.department_id,OLD.profile_completed_at,OLD.character_id,OLD.glasses_id) THEN
    RAISE EXCEPTION 'Participant profile is locked' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION simus.guard_profile_change() FROM PUBLIC;
