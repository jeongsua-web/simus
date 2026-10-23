-- psql entry point. Defaults to a READ ONLY preflight. Does not load/run seeds.
-- Required variables: session_id, mapping_json (canonical JSON file contents).
-- SQL shape/UUID review only. Application must use prepare-phase1-locations.mjs,
-- which also validates canonical source hashes and exact server-graph reachability.
\set ON_ERROR_STOP on
\if :{?apply}
\else
  \set apply false
\endif
\if :apply
  \echo 'Direct SQL apply is disabled. Use db/prepare-phase1-locations.mjs.'
  \quit 2
\endif
BEGIN READ ONLY;

WITH expected(code,id) AS (VALUES
  ('EXHIBITION_02','30000000-0000-0000-0000-000000000002'::uuid),
  ('EXHIBITION_05','30000000-0000-0000-0000-000000000005'::uuid),
  ('EXHIBITION_07','30000000-0000-0000-0000-000000000007'::uuid),
  ('EXHIBITION_13','30000000-0000-0000-0000-000000000013'::uuid),
  ('EXHIBITION_17','30000000-0000-0000-0000-000000000017'::uuid),
  ('EXHIBITION_18','30000000-0000-0000-0000-000000000018'::uuid),
  ('EXHIBITION_28','30000000-0000-0000-0000-000000000028'::uuid),
  ('EXHIBITION_30','30000000-0000-0000-0000-000000000030'::uuid)
), document AS (SELECT :'mapping_json'::jsonb AS doc),
mapping AS (
  SELECT item,doc,item||jsonb_build_object('map_version',doc->'map_version') AS location
  FROM document CROSS JOIN LATERAL jsonb_array_elements(doc->'locations') item
), problems AS (
  SELECT 'Canonical metadata/schema/status is invalid' AS reason FROM document
  WHERE doc->'schema_version' IS DISTINCT FROM '1'::jsonb
    OR doc->'exhibition_ready' IS DISTINCT FROM 'false'::jsonb
    OR doc->>'status' IS DISTINCT FROM 'IMPLEMENTED_AWAITING_QA'
    OR jsonb_typeof(doc->'locations') IS DISTINCT FROM 'array'
  UNION ALL SELECT 'Expected exactly the approved eight unique situation codes'
  WHERE (SELECT count(*) FROM mapping)<>8
    OR EXISTS (SELECT code FROM expected EXCEPT SELECT item->>'situation_code' FROM mapping)
    OR EXISTS (SELECT item->>'situation_code' FROM mapping EXCEPT SELECT code FROM expected)
  UNION ALL SELECT 'Target must be an existing DRAFT with matching configured map/path'
  WHERE NOT EXISTS (SELECT 1 FROM simus.simulation_sessions s,document d
    WHERE s.id=:'session_id'::uuid AND s.status='DRAFT'
      AND s.npc_motion->>'map_version'=d.doc->>'map_version'
      AND s.npc_motion->>'path_version'=d.doc->>'path_version')
  UNION ALL SELECT 'Situation code/UUID differs from the original exhibition seed'
  WHERE EXISTS (SELECT 1 FROM expected e LEFT JOIN simus.session_situations s
    ON s.session_id=:'session_id'::uuid AND s.code=e.code AND s.id=e.id WHERE s.id IS NULL)
  UNION ALL SELECT 'Location, place identity or measured source evidence is incomplete'
  WHERE EXISTS (SELECT 1 FROM mapping WHERE NOT simus.valid_event_location(location)
    OR jsonb_typeof(item->'place_id') IS DISTINCT FROM 'string'
    OR NOT simus.valid_place_id(item->>'place_id')
    OR coalesce(length(item->>'approach_path_id'),0)=0
    OR coalesce(length(item->>'scene_object_path'),0)=0
    OR coalesce(length(item->>'source_evidence'),0)=0)
  UNION ALL SELECT 'A mapped place has conflicting map/point/radius values'
  WHERE EXISTS (SELECT 1 FROM mapping a JOIN mapping b ON a.item->>'place_id'=b.item->>'place_id'
    WHERE ROW(a.location->'point',a.location->'radius_m') IS DISTINCT FROM
      ROW(b.location->'point',b.location->'radius_m'))
  UNION ALL SELECT 'Mapped situations must already be non-generic; content flags are never changed'
  WHERE EXISTS (SELECT 1 FROM simus.session_situations s JOIN expected e ON e.id=s.id
    WHERE s.session_id=:'session_id'::uuid AND s.is_generic)
)
SELECT NOT EXISTS(SELECT 1 FROM problems) AS preflight_ok,
  coalesce((SELECT string_agg(reason, E'\n') FROM problems),'Preflight passed') AS preflight_report
\gset
\echo :preflight_report
\if :preflight_ok
\else
  ROLLBACK;
  \quit 2
\endif

-- Review code/UUID matches before any apply. Never updates the other 22 situations.
SELECT s.code,s.id,s.event_location AS previous_location,item AS proposed_mapping
FROM simus.session_situations s,
  jsonb_array_elements(:'mapping_json'::jsonb->'locations') item
WHERE s.session_id=:'session_id'::uuid AND s.code=item->>'situation_code' ORDER BY s.code;

ROLLBACK;
