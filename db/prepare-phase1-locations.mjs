// Preparation tool only. Default transaction is READ ONLY. Never runs migrations/seeds/QA.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const webDir = path.join(root, 'web');
const requireWeb = createRequire(path.join(webDir, 'package.json'));
const canonicalPath = 'web/src/lib/data/city-v002-phase1-event-locations.json';
const graphPath = 'web/src/lib/data/city-rebuild-v002-phase1-graph.json';
const scenePath = 'unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity';
const expected = [2,5,7,13,17,18,28,30].map(n => ({
  code: `EXHIBITION_${String(n).padStart(2,'0')}`,
  id: `30000000-0000-0000-0000-${String(n).padStart(12,'0')}`,
}));
const identifier = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
function insist(condition, message) { if (!condition) throw new Error(message); }
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
async function evidence(value, expectedPath) {
  insist(value?.path === expectedPath && /^[a-f0-9]{64}$/i.test(value?.sha256 ?? ''), 'Missing exact source path/SHA256');
  insist(digest(await readFile(path.join(root, expectedPath))) === value.sha256.toLowerCase(), 'Source SHA256 mismatch');
}

async function main() {
  const args = process.argv.slice(2);
  let sessionId, environment, apply = false;
  for (let i=0; i<args.length; i++) {
    if (args[i] === '--session') sessionId = args[++i];
    else if (args[i] === '--environment') environment = args[++i];
    else if (args[i] === '--apply') apply = true;
    else throw new Error('Unknown argument');
  }
  insist(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(sessionId ?? ''), '--session UUID is required');
  insist(!apply || environment === 'isolated-development', 'Apply requires --environment isolated-development');
  const original = await readFile(path.join(root, canonicalPath));
  const doc = JSON.parse(original);
  insist(doc.schema_version === 1 && doc.exhibition_ready === false && doc.status === 'IMPLEMENTED_AWAITING_QA', 'Canonical metadata is invalid');
  insist(doc.map_version === 'test-only-city-rebuild-v002-phase1-v1'
    && doc.path_version === 'city-rebuild-v002-walk-phase1-v1', 'Unexpected Phase 1 map/path version');
  insist(Array.isArray(doc.locations) && doc.locations.length === 8, 'Exactly eight mappings are required');
  insist(new Set(doc.locations.map(l=>l.situation_code)).size === 8
    && expected.every(e=>doc.locations.some(l=>l.situation_code === e.code)), 'Only the eight approved codes are permitted');
  await evidence(doc.source_scene, scenePath);
  await evidence(doc.source_graph, graphPath);
  const { MAP_VERSION, PATH_VERSION, locate, routeBetween, nodePoint, defaultMotion, graphMotion } =
    await import('../web/src/lib/city-v002-graph.mjs');
  insist(doc.map_version === MAP_VERSION && doc.path_version === PATH_VERSION, 'Canonical versions differ from server graph');
  const base = graphMotion(defaultMotion());
  const places = new Map();
  for (const l of doc.locations) {
    insist(identifier.test(l.place_id ?? '') && Array.isArray(l.point) && l.point.length === 3
      && l.point.every(n=>Number.isFinite(n) && Math.abs(n)<=1000000)
      && Number.isFinite(l.radius_m) && l.radius_m>0 && l.radius_m<=1000000, 'Invalid location shape');
    insist(typeof l.approach_path_id === 'string' && l.approach_path_id.length>0
      && typeof l.scene_object_path === 'string' && l.scene_object_path.length>0
      && ((typeof l.source_evidence === 'string' && l.source_evidence.length>0)
        || (l.source_evidence && typeof l.source_evidence === 'object' && Object.keys(l.source_evidence).length>0)), 'Measured location evidence is required');
    const position = JSON.stringify({map_version:doc.map_version,point:l.point,radius_m:l.radius_m});
    insist(!places.has(l.place_id) || places.get(l.place_id)===position, 'Same place has conflicting coordinates');
    places.set(l.place_id,position);
    locate(l.point); // Exact 3D projection tolerance from the server graph, including Y.
    insist(typeof l.approach_node_id==='string'
      && nodePoint(l.approach_node_id).every((coordinate,i)=>coordinate===l.point[i]), 'Location must equal its named measured graph anchor');
    routeBetween(base.points[0],l.point); // Connected to the actual participant route.
  }
  requireWeb('@next/env').loadEnvConfig(webDir, false, {info(){},error(){}});
  insist(Boolean(process.env.DATABASE_URL), 'Server database connection is not configured');
  const {Client} = requireWeb('pg');
  const client = new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,statement_timeout:15000});
  let connected = false;
  try {
    await client.connect(); connected = true;
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
    const session = await client.query(`SELECT status,npc_motion FROM simus.simulation_sessions
      WHERE id=$1 ${apply ? 'FOR UPDATE' : ''}`, [sessionId]);
    insist(session.rowCount===1 && session.rows[0].status==='DRAFT', 'Target must be an existing DRAFT');
    const motion = session.rows[0].npc_motion;
    insist(motion?.map_version===doc.map_version && motion?.path_version===doc.path_version, 'DRAFT map/path mismatch');
    graphMotion(motion);
    const rows = await client.query(`SELECT code,id,event_location,is_generic FROM simus.session_situations
      WHERE session_id=$1 AND code=ANY($2::text[]) ORDER BY code`, [sessionId,expected.map(e=>e.code)]);
    insist(rows.rowCount===8 && expected.every(e=>rows.rows.some(r=>r.code===e.code && r.id===e.id && !r.is_generic)), 'DRAFT code/UUID/non-generic check failed');
    // No migrations are applied here; require the 016 contract to have been approved/applied separately.
    await client.query('SELECT location_occupancy,location_evaluated_at,overdue_since FROM simus.npc_event_states LIMIT 0');
    const conflicts = await client.query(`SELECT code,event_location FROM simus.session_situations
      WHERE session_id=$1 AND NOT(code=ANY($2::text[])) AND event_location->>'place_id'=ANY($3::text[])`,
      [sessionId,expected.map(e=>e.code),[...places.keys()]]);
    insist(conflicts.rows.every(r=>places.get(r.event_location.place_id) === JSON.stringify({
      map_version:r.event_location.map_version,point:r.event_location.point,radius_m:r.event_location.radius_m})), 'Place conflicts with another situation');
    console.log(JSON.stringify({mode:apply?'APPLY':'READ_ONLY_PREFLIGHT',session_id:sessionId,
      mappings:rows.rows.map(r=>({code:r.code,id:r.id,proposed:doc.locations.find(l=>l.situation_code===r.code)}))},null,2));
    if (apply) {
      for (const l of doc.locations) {
        const result = await client.query(`UPDATE simus.session_situations SET event_location=$3::jsonb
          WHERE session_id=$1 AND code=$2`, [sessionId,l.situation_code,JSON.stringify({
            map_version:doc.map_version,place_id:l.place_id,point:l.point,radius_m:l.radius_m})]);
        insist(result.rowCount===1, 'Location update count mismatch');
      }
      insist((await readFile(path.join(root,canonicalPath))).equals(original), 'Canonical mapping changed during preparation');
      await evidence(doc.source_scene,scenePath);
      await evidence(doc.source_graph,graphPath);
      await client.query('COMMIT');
      console.log('Applied eight DRAFT locations; no other content or runtime state changed.');
    } else await client.query('ROLLBACK');
  } catch (error) {
    if (connected) await client.query('ROLLBACK').catch(()=>{});
    throw error;
  } finally { await client.end().catch(()=>{}); }
}
main().catch(error=>{
  // PostgreSQL error details may contain connection data: emit only its code.
  console.error(error.code ? `Preparation failed (${error.code})` : error.message);
  process.exitCode=1;
});
