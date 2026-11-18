-- Allow validated v003 drafts; existing sessions and placements stay unchanged.
BEGIN;
ALTER TABLE simus.session_creation_requests DROP CONSTRAINT session_creation_requests_npc_profile_check;
ALTER TABLE simus.session_creation_requests ADD CONSTRAINT session_creation_requests_npc_profile_check
  CHECK (npc_profile IS NULL OR npc_profile IN ('city-rebuild-v002','city-masterplan-v003'));
ALTER TABLE simus.session_creation_requests DROP CONSTRAINT initial_session_profile;
ALTER TABLE simus.session_creation_requests ADD CONSTRAINT initial_session_profile
  CHECK (template_session_id IS NOT NULL OR
    (npc_profile IS NOT NULL AND npc_profile IN ('city-rebuild-v002','city-masterplan-v003')));
COMMIT;
