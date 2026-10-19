-- Additive only: no session, membership snapshot or existing event state is rewritten.
BEGIN;
ALTER TABLE simus.npc_event_states ADD COLUMN guidance_motion jsonb
  CHECK (guidance_motion IS NULL OR simus.valid_npc_motion(guidance_motion));
ALTER TABLE simus.npc_event_states ADD CONSTRAINT guidance_motion_has_target
  CHECK (guidance_motion IS NULL OR (guidance_point IS NOT NULL
    AND guidance_motion->'points'->0 = guidance_origin
    AND guidance_motion->'points'-> -1 = guidance_point
    AND guidance_motion->>'loop' = 'false'));
ALTER TABLE simus.session_creation_requests ADD COLUMN npc_profile text
  CHECK (npc_profile IS NULL OR npc_profile = 'city-rebuild-v002');
COMMIT;
