// Execute unchanged server sources with a deliberately limited in-memory SQL port.
// No pg client, connection string, schema, migration, or database is used here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import * as graph from '../src/lib/city-v002-graph.mjs';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.dirname(web);
const nativeRequire = createRequire(import.meta.url);
const loaded = new Map();
const inputHashes = {};
class ApiError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
function load(relative) {
  const absolute = path.resolve(web, relative);
  if (loaded.has(absolute)) return loaded.get(absolute);
  const source = fs.readFileSync(absolute, 'utf8');
  inputHashes[path.relative(root, absolute).replaceAll('\\', '/')] = createHash('sha256').update(source).digest('hex');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  loaded.set(absolute, module.exports);
  const require = name => {
    if (name === './api') return { ApiError, transaction: () => { throw new Error('Real transaction forbidden in this harness'); } };
    if (name.endsWith('city-v002-graph.mjs')) return graph;
    if (name.startsWith('node:')) return nativeRequire(name);
    const target = name.startsWith('@/') ? path.join(web, 'src', name.slice(2)) : path.resolve(path.dirname(absolute), name);
    return load(path.relative(web, target + '.ts'));
  };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { Date, console, setTimeout, clearTimeout }, { filename: absolute })(require, module, module.exports);
  return module.exports;
}
const { scanPlace } = load('src/lib/npc-place-trajectory.ts');
const { advanceEvent, syncNpcEvents, completeEvent } = load('src/lib/npc-events.ts');
const { npcPosition } = load('src/app/participate/npc-motion.ts');
const { returnMotion, resumedNpc } = load('src/lib/npc-graph-motion.ts');
const { parseEventLocation, assertLocationGroups } = load('src/lib/event-locations.ts');
const canonical = JSON.parse(fs.readFileSync(path.join(web, 'src/lib/data/city-v002-phase1-event-locations.json'), 'utf8'));
for (const file of ['src/lib/city-v002-graph.mjs', 'src/lib/data/city-rebuild-v002-phase1-graph.json', 'src/lib/data/city-v002-phase1-event-locations.json']) inputHashes[`web/${file}`] = createHash('sha256').update(fs.readFileSync(path.join(web, file))).digest('hex');
const base = Date.parse('2026-10-20T00:00:00.000Z');
const date = ms => new Date(base + ms);
const clone = value => structuredClone(value);
const normalize = value => JSON.parse(JSON.stringify(value));
const motion = (points, loop = false, speed = 1, map = 'test-memory-v1') => ({ map_version: map, path_version: map === canonical.map_version ? canonical.path_version : 'memory-path', points, loop, speed_mps: speed });
const npc = m => ({ npc_id: 'n1', epoch: date(0).toISOString(), motion: m });
const place = (point = [5, 0, 0], radius = 1, id = 'place-a', map = 'test-memory-v1') => ({ place_id: id, map_version: map, point, radius_m: radius });
const situation = (id, location) => ({ id, code: id, title: id, body: '', display_order: 1, is_generic: !location, event_location: location, choices: [{ id: `${id}-choice`, label: 'choose', display_order: 1 }] });

class MemoryDb {
  constructor(m = motion([[0, 0, 0], [10, 0, 0]]), situations = [situation('s1', place())]) {
    this.now = 0; this.events = []; this.answered = []; this.calls = [];
    this.session = { id: 'session', status: 'RUNNING', admission_closed_at: null, starts_at: date(0), scheduled_end_at: date(3600000), admission_buffer: {} };
    this.member = { participant_id: 'p1', npc_id: 'n1', npc_motion: m, waiting_since: date(0), motion_epoch: date(0), paused_ms: '0', resume_motion: null, guidance_point: null, guidance_origin: null, guidance_started_at: null, guidance_motion: null, location_occupancy: {}, location_evaluated_at: date(0), overdue_since: null, motion_revision: '0', active: null };
    this.situations = situations;
  }
  async query(sql, args = []) {
    const q = sql.replace(/\s+/g, ' ').trim(); this.calls.push(q);
    if (q.startsWith('SELECT *,clock_timestamp() AS now')) return { rows: [{ ...clone(this.session), now: date(this.now) }] };
    if (q.startsWith('INSERT INTO simus.npc_event_states')) return { rows: [] };
    if (q.startsWith('SELECT p.participant_id')) return { rows: [clone(this.member)] };
    if (q.startsWith('SELECT t.*, COALESCE')) return { rows: clone(this.situations) };
    if (q.startsWith('SELECT DISTINCT participant_id,situation_id')) return { rows: this.answered.map(situation_id => ({ participant_id: 'p1', situation_id })) };
    if (q.startsWith('UPDATE simus.npc_event_states st SET location_occupancy=')) {
      for (const row of JSON.parse(args[1])) Object.assign(this.member, { location_occupancy: row.location_occupancy, location_evaluated_at: new Date(row.location_evaluated_at), overdue_since: row.overdue_since ? new Date(row.overdue_since) : null });
      return { rows: [] };
    }
    if (q.startsWith('INSERT INTO simus.npc_events(')) {
      // Fake constraints help expose unintended duplicate attempts, but do not prove SQL correctness.
      const rows = JSON.parse(args[1]).map(row => {
        assert.equal(this.member.active, null, 'second ACTIVE attempted');
        assert.ok(!this.events.some(e => e.place_id === row.place_id && e.entry_seq === String(row.entry_seq)), 'duplicate place/entry attempted');
        const e = { ...row, id: `e${this.events.length + 1}`, started_at: new Date(row.started_at), entry_seq: String(row.entry_seq) };
        this.events.push(e); this.member.active = e; return clone(e);
      });
      return { rows };
    }
    if (q.startsWith('UPDATE simus.npc_event_states SET motion_revision=')) { this.member.motion_revision = String(Number(this.member.motion_revision) + 1); return { rows: [] }; }
    if (q.startsWith('UPDATE simus.npc_event_states st SET guidance_point=')) {
      for (const row of JSON.parse(args[1])) Object.assign(this.member, { guidance_point: row.guidance_point, guidance_origin: row.guidance_origin, guidance_motion: row.guidance_motion ?? null, guidance_started_at: date(this.now) });
      return { rows: [] };
    }
    if (q.startsWith('SELECT st.*,p.npc_motion,e.started_at')) return { rows: [{ ...clone(this.member), started_at: clone(this.events.find(e => e.id === args[2]).started_at) }] };
    if (q.startsWith('UPDATE simus.npc_event_states SET resume_motion=')) { Object.assign(this.member, { resume_motion: JSON.parse(args[2]), motion_epoch: date(this.now), paused_ms: '0' }); return { rows: [] }; }
    if (q.startsWith('UPDATE simus.npc_event_states st SET waiting_since=')) {
      const e = this.events.find(e => e.id === args[2]);
      Object.assign(this.member, { waiting_since: date(this.now), overdue_since: null, location_evaluated_at: date(this.now), paused_ms: this.member.guidance_point ? '0' : String(Number(this.member.paused_ms) + date(this.now).getTime() - e.started_at.getTime()), guidance_point: null, guidance_origin: null, guidance_started_at: null, guidance_motion: null });
      return { rows: [] };
    }
    if (q.startsWith("UPDATE simus.npc_events SET status='COMPLETED'")) { this.member.active = null; return { rows: [] }; }
    throw new Error(`Unsupported SQL: ${q}`);
  }
  async poll(at) { this.now = at; return advanceEvent(this, 'session', 'p1'); }
  async answer(at) { this.now = at; const e = this.member.active; this.answered.push(e.situation_id); await completeEvent(this, 'session', 'p1', e.id); }
}

const results = [];
async function test(name, run) { try { const detail = await run(); results.push({ name, status: 'PASS_IN_MEMORY_RUNTIME', ...(detail ? { detail } : {}) }); } catch (error) { results.push({ name, status: 'FAIL_IN_MEMORY_RUNTIME', error: error.stack }); } }
await test('straight pass-through reconstructed despite polling after exit', () => {
  const n = npc(motion([[0, 0, 0], [10, 0, 0]]));
  const r = scanPlace(n, base, base + 10000, place(), false);
  assert.equal(r.entries, 1); assert.equal(r.inside, false); assert.equal(r.firstEntry, base + 4000);
});
await test('long polling gap counts narrow-radius loop entries without sampling', () => {
  const r = scanPlace(npc(motion([[0, 0, 0], [10, 0, 0]], true)), base, base + 1000000, place([5, 0, 0], .001), false);
  assert.equal(r.entries, 100); assert.equal(r.firstEntry, base + 4999); assert.equal(r.inside, false);
});
await test('loop seam inside interval and entire-loop occupancy do not double enter', () => {
  const n = npc(motion([[0, 0, 0], [10, 0, 0]], true));
  const r = scanPlace(n, base, base + 41000, place([0, 0, 0], 1), false);
  assert.equal(r.entries, 3);
  assert.equal(scanPlace(n, base, base + 41000, place([5, 0, 0], 10), true).entries, 0);
});
await test('corner polyline never replaced by polling chord', () => {
  const r = scanPlace(npc(motion([[0, 0, 0], [0, 0, 10], [10, 0, 10]])), base, base + 20000, place([5, 0, 5], 1), false);
  assert.equal(r.entries, 0); assert.equal(r.firstEntry, null);
});
await test('submillisecond tangent is not frozen outside radius', () => {
  const r = scanPlace(npc(motion([[0, 0, 0], [10, 0, 0]], false, 3)), base, base + 4000, place([5, 1, 0], 1), false);
  assert.equal(r.firstEntry, null);
});
await test('earliest eligible entry freezes at entry, duplicate polling and reconnect do not duplicate', async () => {
  const db = new MemoryDb(); const r = await db.poll(10000);
  assert.equal(r.phase, 'ACTIVE'); assert.equal(r.event.trigger_kind, 'LOCATION'); assert.equal(r.event.entry_seq, '1');
  assert.equal(r.event.started_at.getTime(), base + 4000);
  assert.ok(graph.distance(npcPosition(npc(db.member.npc_motion), r.event.started_at.getTime()), place().point) <= 1);
  await db.poll(20000); await syncNpcEvents(db, 'session'); await db.poll(20000);
  assert.equal(db.events.length, 1); assert.equal(db.member.location_evaluated_at.getTime(), base + 4000);
});
await test('same-place situations cannot chain while inside; real exit and reentry permits next unanswered', async () => {
  const db = new MemoryDb(motion([[0, 0, 0], [10, 0, 0]], true), [situation('s1', place()), situation('s2', place())]);
  await db.poll(5000); await db.answer(10000);
  await db.poll(10000); await db.poll(11000); assert.equal(db.events.length, 1);
  await db.poll(22000); assert.equal(db.events.length, 2); assert.equal(db.events[1].entry_seq, '2');
  assert.notEqual(db.events[1].situation_id, db.events[0].situation_id);
  await db.answer(23000); await db.poll(100000); assert.equal(db.events.length, 2);
});
await test('completion clock expressions separated by 1 ms must not create synthetic reentry', async () => {
  const db = new MemoryDb(motion([[0, 0, 0], [10, 0, 0]], true), [situation('s1', place()), situation('s2', place())]);
  await db.poll(5000); await db.answer(10000);
  // Model PostgreSQL clock_timestamp() crossing the millisecond between the
  // evaluated_at expression and paused_ms expression; not a real SQL execution.
  db.member.paused_ms = String(Number(db.member.paused_ms) + 1);
  await db.poll(10001);
  assert.equal(db.events.length, 1, 'remaining at the frozen boundary generated a second occurrence');
});
await test('overlapping distinct places consume one simultaneous entry together', async () => {
  const db = new MemoryDb(motion([[0, 0, 0], [10, 0, 0]]), [situation('s1', place()), situation('s2', place([5, 0, 0], 1, 'place-b'))]);
  await db.poll(5000); await db.answer(6000); await db.poll(6000);
  assert.equal(db.events.length, 1); assert.equal(db.member.location_occupancy['place-b'].consumed_entry_seq, 1);
});
await test('first inside evaluation counts once; legacy null cursor does not replay old crossings', async () => {
  const inside = new MemoryDb(motion([[5, 0, 0], [5, 0, 0]], false, 0));
  await inside.poll(0); assert.equal(inside.events.length, 1); await inside.poll(1000); assert.equal(inside.events.length, 1);
  const legacy = new MemoryDb(); legacy.member.location_evaluated_at = null;
  await legacy.poll(10000); assert.equal(legacy.events.length, 0);
});
await test('active freeze consumes no future place entries', async () => {
  const db = new MemoryDb(motion([[0, 0, 0], [10, 0, 0]]), [situation('s1', place()), situation('s2', place([9, 0, 0], .5, 'place-b'))]);
  await db.poll(5000); await db.poll(500000);
  assert.equal(db.member.location_occupancy['place-b'].entry_seq, 0); assert.equal(db.events.length, 1);
});
await test('60-second guidance; 90-second overdue only, persisted across polls', async () => {
  const db = new MemoryDb(motion([[0, 0, 0], [1, 0, 0]]), [situation('s1', place([1000, 0, 0]))]);
  assert.equal((await db.poll(59999)).phase, 'WAITING'); assert.equal((await db.poll(60000)).phase, 'GUIDING');
  const r = await db.poll(90000); assert.equal(r.event, null); assert.equal(r.overdue, true); assert.equal(r.overdue_since, date(90000).toISOString());
  assert.equal((await db.poll(100000)).overdue_since, date(90000).toISOString()); assert.equal(db.events.length, 0);
});
await test('unlocated generic and wrong-map content never creates deadline fallback', async () => {
  const db = new MemoryDb(motion([[0, 0, 0], [10, 0, 0]]), [situation('generic', null), situation('wrong', place([5, 0, 0], 1, 'other', 'other-map'))]);
  const r = await db.poll(100000); assert.equal(r.phase, 'WAITING'); assert.equal(r.overdue, true); assert.equal(db.events.length, 0);
});
await test('earliest location wins independent of situation list order', async () => {
  const db = new MemoryDb(motion([[0, 0, 0], [10, 0, 0]]), [situation('later', place([9, 0, 0], 1, 'later')), situation('earlier', place([3, 0, 0], 1, 'earlier'))]);
  const r = await db.poll(10000); assert.equal(r.event.situation_id, 'earlier'); assert.equal(r.event.started_at.getTime(), base + 2000);
});
await test('overdue survives entry and ACTIVE polling until successful completion', async () => {
  const db = new MemoryDb(motion([[0, 0, 0], [10, 0, 0]]));
  db.member.overdue_since = date(-90000);
  const r = await db.poll(5000); assert.equal(r.overdue, true);
  assert.equal((await db.poll(8000)).overdue_since, date(-90000).toISOString());
  await db.answer(10000); assert.equal((await db.poll(10000)).overdue, false);
});
await test('stored legacy DEADLINE occurrence remains readable and completable', async () => {
  const db = new MemoryDb(); const legacy = { id: 'legacy', situation_id: 's1', started_at: date(0), trigger_kind: 'DEADLINE', place_id: null, entry_seq: null };
  db.events.push(legacy); db.member.active = legacy;
  assert.equal((await db.poll(1000)).event.trigger_kind, 'DEADLINE');
  await db.answer(2000); assert.equal(db.member.active, null); assert.equal(db.events.length, 1);
});
await test('closed, future-start and admission-cutoff sessions produce no event', async () => {
  for (const variant of ['FINALIZED', 'DRAFT', 'before-start', 'cutoff', 'admission-closed']) {
    const db = new MemoryDb();
    if (variant === 'before-start') db.session.starts_at = date(20000);
    else if (variant === 'cutoff') { db.session.scheduled_end_at = date(11000); db.session.admission_buffer = { seconds: 1 }; }
    else if (variant === 'admission-closed') db.session.admission_closed_at = date(5000);
    else db.session.status = variant;
    assert.equal((await db.poll(10000)).phase, 'CLOSED'); assert.equal(db.events.length, 0);
  }
});
await test('consumed occupancy without fresh content advances cursor but produces no event', async () => {
  const db = new MemoryDb(); db.answered = ['s1']; await db.poll(5000);
  assert.equal(db.events.length, 0); assert.equal(db.member.location_occupancy['place-a'].entry_seq, 1);
  assert.equal(db.member.location_occupancy['place-a'].consumed_entry_seq, 1);
});
await test('entry counter overflow is rejected rather than rounded', async () => {
  const db = new MemoryDb(); db.member.location_occupancy['place-a'] = { inside: false, entry_seq: Number.MAX_SAFE_INTEGER, consumed_entry_seq: Number.MAX_SAFE_INTEGER };
  await assert.rejects(db.poll(5000), e => e.code === 'EVENT_ENTRY_LIMIT');
});
await test('event location parser rejects malformed geometry and group conflicts', () => {
  for (const v of [null, { ...place(), place_id: '' }, { ...place(), point: [0, 0] }, { ...place(), radius_m: 0 }, { ...place(), point: [NaN, 0, 0] }]) assert.throws(() => parseEventLocation(v));
  assert.throws(() => assertLocationGroups([place(), place([6, 0, 0])]), e => e.code === 'EVENT_PLACE_CONFLICT');
  assert.throws(() => assertLocationGroups([place()], 'different-map'), e => e.code === 'NPC_MAP_MISMATCH');
});

const plaza = graph.pedestrianGraph.nodes.find(n => n.id === 'CAMPUS_PLAZA').position;
for (const location of canonical.locations) await test(`${location.situation_code}: actual graph route entry, radius, freeze and reconnection`, async () => {
  const l = { ...location, map_version: canonical.map_version };
  const points = graph.routeBetween(plaza, l.point, canonical.map_version);
  const m = motion(points, false, 1.4, canonical.map_version);
  const elapsed = Math.ceil(graph.pathLength(points) / 1.4 * 1000) + 1000;
  const db = new MemoryDb(m, [situation(location.situation_code, l)]);
  const result = await db.poll(elapsed);
  assert.equal(result.phase, 'ACTIVE'); assert.equal(result.event.place_id, l.place_id);
  const at = result.event.started_at.getTime(); const position = npcPosition(npc(m), at);
  const euclidean = graph.distance(position, l.point), alongGraph = graph.graphDistanceTo(l.point, canonical.map_version)(position);
  assert.ok(euclidean <= l.radius_m + 1e-8); assert.ok(alongGraph <= l.radius_m + 1e-8);
  assert.equal(scanPlace(npc(m), base, at - 1, l, false).firstEntry, null);
  await db.poll(elapsed + 10000); assert.equal(db.events.length, 1);
  return { route_points: points.length, route_m: graph.pathLength(points), entry_ms: at - base, radius_m: l.radius_m, euclidean_m: euclidean, graph_distance_m: alongGraph };
});
await test('graph zero-speed and off-graph locations cannot fabricate guidance or event', async () => {
  const p = canonical.locations[0];
  const db = new MemoryDb(motion([plaza, plaza], false, 0, canonical.map_version), [situation('s1', { ...p, map_version: canonical.map_version })]);
  assert.equal((await db.poll(100000)).phase, 'WAITING'); assert.equal(db.events.length, 0);
  const off = new MemoryDb(motion([plaza, plaza], false, 1, canonical.map_version), [situation('s1', place([999, 0, 999], 1, 'off', canonical.map_version))]);
  assert.equal((await off.poll(100000)).phase, 'WAITING'); assert.equal(off.events.length, 0);
});
await test('60-second graph guidance chooses nearest unoccupied reachable place', async () => {
  const locations = canonical.locations.map(l => ({ ...l, map_version: canonical.map_version }));
  const distances = locations.map(l => ({ id: l.place_id, distance: graph.pathLength(graph.routeBetween(plaza, l.point, canonical.map_version)) })).sort((a, b) => a.distance - b.distance);
  const db = new MemoryDb(motion([plaza, plaza], false, 1.4, canonical.map_version), locations.map((l, i) => situation(`s${i}`, l)));
  const r = await db.poll(60000); assert.equal(r.phase, 'GUIDING');
  assert.deepEqual(normalize(db.member.guidance_point), locations.find(l => l.place_id === distances[0].id).point);
  assert.deepEqual(normalize(db.member.guidance_motion.points), normalize(graph.routeBetween(plaza, db.member.guidance_point, canonical.map_version)));
  return { nearest_place_id: distances[0].id, graph_distance_m: distances[0].distance };
});
await test('consumed occupied graph place is excluded from 60-second guidance', async () => {
  const occupied = { ...canonical.locations[0], map_version: canonical.map_version };
  const other = { ...canonical.locations[1], map_version: canonical.map_version };
  const db = new MemoryDb(motion([occupied.point, occupied.point], false, 1.4, canonical.map_version), [situation('occupied', occupied), situation('other', other)]);
  db.member.location_occupancy[occupied.place_id] = { inside: true, entry_seq: 1, consumed_entry_seq: 1 };
  const r = await db.poll(60000); assert.equal(r.phase, 'GUIDING'); assert.deepEqual(normalize(db.member.guidance_point), other.point); assert.equal(db.events.length, 0);
});
await test('graph guidance arrival, completion, fractional connector handoff remain on graph', async () => {
  const target = { ...canonical.locations[1], map_version: canonical.map_version };
  const originalRoute = graph.routeBetween(plaza, canonical.locations[0].point, canonical.map_version);
  const original = motion(originalRoute, true, 1.4, canonical.map_version);
  const db = new MemoryDb(original, [situation('s1', target)]);
  assert.equal((await db.poll(60000)).phase, 'GUIDING');
  const r = await db.poll(1000000); assert.equal(r.phase, 'ACTIVE');
  await db.answer(1001000); assert.equal(db.member.overdue_since, null);
  assert.ok(db.member.resume_motion.rejoin_after_ms >= 0);
  const handoff = base + 1001000 + db.member.resume_motion.rejoin_after_ms;
  const points = [handoff - 1, handoff, handoff + 1].map(at => npcPosition(resumedNpc(db.member, original, at), at));
  for (const p of points) assert.ok(Number.isFinite(graph.graphDistanceTo(plaza, canonical.map_version)(p)));
  assert.ok(graph.distance(points[0], points[2]) < .01);
  await db.poll(Math.ceil(handoff - base + 1000)); assert.equal(db.events.length, 1);
  return { handoff_ms: db.member.resume_motion.rejoin_after_ms, positions: normalize(points) };
});
await test('direct returnMotion with fractional handoff preserves original loop shape', () => {
  const original = motion(graph.routeBetween(plaza, canonical.locations[0].point, canonical.map_version), true, 1.4, canonical.map_version);
  const returned = returnMotion(original, canonical.locations[1].point);
  assert.equal(returned.loop, false); assert.equal(returned.rejoin_motion.loop, true);
  assert.ok(Number.isFinite(returned.rejoin_after_ms)); assert.ok(returned.rejoin_after_ms > 0);
});

const report = { generated_at: new Date().toISOString(), scope: 'UNCHANGED_SERVER_SOURCES_EXECUTED_WITH_IN_MEMORY_SQL_PORT', database: 'BLOCKED_NOT_RUN: no PostgreSQL connection, schema application or migration authorized', limits: ['No SQL execution, PostgreSQL lock/unique/check semantics or transaction rollback validation', 'No actual choices/stat ledger write or HTTP/cookie/Next.js route execution', 'No Unity, physical clearance, WebGL, deployment or mobile verification', 'Simulated database statements are a test fixture; results are not database integration PASS'], input_hashes: inputHashes, passed: results.filter(r => r.status.startsWith('PASS')).length, failed: results.filter(r => r.status.startsWith('FAIL')).length, results };
const destination = path.join(root, 'docs/verification/phase1/server-memory-results.json');
fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ evidence: destination, passed: report.passed, failed: report.failed, failures: results.filter(r => r.status.startsWith('FAIL')) }, null, 2));
process.exitCode = report.failed ? 1 : 0;
