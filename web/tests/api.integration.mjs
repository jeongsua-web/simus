// Run only against a disposable database initialized with db/*.sql (schema + development seed).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const base = process.env.TEST_API_URL ?? 'http://localhost:3101';
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to a disposable database');
const db = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const sid = '10000000-0000-0000-0000-000000000001';
const tid = '30000000-0000-0000-0000-000000000001';
const cid = '40000000-0000-0000-0000-000000000001';
async function call(path, data, cookie, method) {
  const response = await fetch(base + path, { method: method ?? (data ? 'POST' : 'GET'),
    headers: { ...(data ? {'Content-Type':'application/json'} : {}), ...(cookie ? {cookie} : {}) },
    body: data ? JSON.stringify(data) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
try {
  const current = await call('/api/sessions/current');
  assert.equal(current.body.session.id, sid);
  assert.equal(current.body.session.situations[0].choices.length, 2);
  assert.ok(!JSON.stringify(current.body).includes('alignment_dx'));
  const person = await call('/api/participants', null, null, 'POST');
  assert.equal(person.status, 201);
  assert.ok(person.cookie);
  const same = await call('/api/participants', null, person.cookie, 'POST');
  assert.equal(same.body.participant_id, person.body.participant_id);
  const payload = {session_id:sid,situation_id:tid,choice_id:cid,request_key:randomUUID()};
  assert.equal((await call('/api/choices',payload)).status,401);
  assert.equal((await call('/api/choices',{...payload,choice_id:'bad'},person.cookie)).status,400);
  const before = (await call('/api/city-state')).body.city_state;
  const submissions = await Promise.all([call('/api/choices',payload,person.cookie),call('/api/choices',payload,person.cookie)]);
  assert.deepEqual(submissions.map(r=>r.status).sort(),[200,201]);
  assert.equal(submissions[0].body.record_id,submissions[1].body.record_id);
  const after = (await call('/api/city-state')).body.city_state;
  assert.equal(BigInt(after.version),BigInt(before.version)+1n);
  assert.equal(after.happiness,Math.min(100,before.happiness+1));
  assert.equal(after.cleanliness,Math.min(100,before.cleanliness+4));
  assert.equal(after.regions[0].pollution,Math.max(0,before.regions[0].pollution-3));
  assert.equal((await call('/api/choices',{...payload,choice_id:'40000000-0000-0000-0000-000000000002'},person.cookie)).status,409);
  assert.equal((await call('/api/choices',{...payload,request_key:randomUUID()},person.cookie)).status,409);
  const scores = (await db.query('SELECT * FROM simus.participant_alignments WHERE session_id=$1 AND participant_id=$2',[sid,person.body.participant_id])).rows[0];
  assert.equal(scores.x_score,'1'); assert.equal(scores.y_score,'1'); assert.equal(scores.response_count,'1');
  const p2 = await call('/api/participants',null,null,'POST');
  await db.query('UPDATE simus.city_states SET happiness=99,cleanliness=99 WHERE session_id=$1',[sid]);
  assert.equal((await call('/api/choices',{...payload,request_key:randomUUID()},p2.cookie)).status,201);
  const clamped = (await call('/api/city-state')).body.city_state;
  assert.equal(clamped.happiness,100); assert.equal(clamped.cleanliness,100);
  const p3 = await call('/api/participants',null,null,'POST');
  await db.query("UPDATE simus.simulation_sessions SET admission_closed_at=clock_timestamp() WHERE id=$1",[sid]);
  assert.equal((await call('/api/choices',{...payload,request_key:randomUUID()},p3.cookie)).status,409);
  assert.equal((await call('/api/choices',payload,person.cookie)).status,200);
  assert.equal((await call('/api/sessions/current')).body.session.accepting_choices,false);
  assert.equal((await db.query('SELECT count(*) FROM simus.choice_records WHERE session_id=$1',[sid])).rows[0].count,'2');
  console.log('PASS: current session, identity reuse, authentication, validation, concurrent replay, conflicts, scores, clamping, closed-session rejection');
} finally { await db.end(); }
