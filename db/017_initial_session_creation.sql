-- Additive request metadata change; no sessions, administrators or content are inserted.
BEGIN;
ALTER TABLE simus.session_creation_requests ALTER COLUMN template_session_id DROP NOT NULL;
ALTER TABLE simus.session_creation_requests ADD CONSTRAINT initial_session_profile
  CHECK (template_session_id IS NOT NULL OR npc_profile IS NOT DISTINCT FROM 'city-rebuild-v002');
-- Across administrators/keys, at most one initial creation can ever be recorded.
CREATE UNIQUE INDEX one_initial_session_creation ON simus.session_creation_requests ((true))
  WHERE template_session_id IS NULL;
COMMENT ON COLUMN simus.session_creation_requests.template_session_id IS
  'NULL means initial content creation; otherwise the source session copied. Immutable request metadata.';
COMMIT;
