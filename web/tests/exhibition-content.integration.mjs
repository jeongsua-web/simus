import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runExhibitionContentIntegration({ pool, env, token }) {
  const sid = '16000000-0000-0000-0000-000000000001';
  const counts = await pool.query(`SELECT
    (SELECT count(*)::int FROM simus.session_situations WHERE session_id=$1) AS situations,
    (SELECT count(*)::int FROM simus.session_choices WHERE session_id=$1) AS choices,
    (SELECT min(alignment_dx)::int FROM simus.session_choices WHERE session_id=$1) AS min_order,
    (SELECT max(alignment_dy)::int FROM simus.session_choices WHERE session_id=$1) AS max_morality`, [sid]);
  assert.deepEqual(counts.rows[0], { situations: 30, choices: 91, min_order: -4, max_morality: 3 });
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const action = async name => fetch(`${env.TEST_API_URL}/api/admin/sessions/${sid}/${name}`, {
    method: 'POST', headers, body: JSON.stringify({ request_key: randomUUID() }),
  });
  assert.equal((await action('start')).status, 200);
  const person = await fetch(`${env.TEST_API_URL}/api/participants`, { method: 'POST' });
  assert.equal(person.status, 201);
  const cookie = person.headers.get('set-cookie').split(';')[0];
  const selected = await fetch(`${env.TEST_API_URL}/api/choices`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ session_id: sid, situation_id: '30000000-0000-0000-0000-000000000026',
      choice_id: '40000000-0000-0000-0000-000000000263', request_key: randomUUID() }),
  });
  assert.equal(selected.status, 201, await selected.text());
  const ledger = await pool.query(`SELECT alignment_dx,alignment_dy,safety_delta_requested::float8
    FROM simus.choice_records WHERE session_id=$1`, [sid]);
  assert.deepEqual(ledger.rows[0], { alignment_dx: -4, alignment_dy: -4, safety_delta_requested: -4 });
  const alignment = await pool.query(`SELECT x_score::text,y_score::text FROM simus.participant_alignments
    WHERE session_id=$1`, [sid]);
  assert.deepEqual(alignment.rows[0], { x_score: '-4', y_score: '-4' });
  assert.equal((await action('end')).status, 200);
  console.log('PASS: original 30/91 content, -4 choice applied and preserved in ledger, previous session rules unaffected');
}
