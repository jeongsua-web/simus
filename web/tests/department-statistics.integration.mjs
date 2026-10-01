import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runDepartmentStatisticsIntegration({ env, token, templateId }) {
  async function call(path, { method = 'GET', data, cookie, admin = false } = {}) {
    const response = await fetch(env.TEST_API_URL + path, {
      method,
      headers: { ...(cookie ? { cookie } : {}), ...(admin ? { authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'content-type': 'application/json' } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const created = await call('/api/admin/sessions', { method: 'POST', admin: true, data: {
    template_session_id: templateId, name: '4A 학과 집계 검증', duration_seconds: 300,
    impact_scale: 0.1, request_key: randomUUID(),
  } });
  assert.equal(created.status, 201);
  const sid = created.body.session_id;
  const path = `/api/sessions/${sid}/department-statistics`;
  assert.equal((await call('/api/sessions/00000000-0000-0000-0000-000000000000/department-statistics')).status, 404);
  assert.equal((await call(`/api/admin/sessions/${sid}/start`, { method: 'POST', admin: true,
    data: { request_key: randomUUID() } })).status, 200);
  const current = (await call('/api/sessions/current')).body.session;
  const situation = current.situations[0];
  const people = [];
  for (let i = 0; i < 6; i++) {
    const person = await call('/api/participants', { method: 'POST' });
    assert.equal(person.status, 201);
    assert.equal((await call(`/api/sessions/${sid}/join`, { method: 'POST', cookie: person.cookie })).status, 201);
    assert.equal((await call(`/api/sessions/${sid}/department`, { method: 'PUT', cookie: person.cookie,
      data: { department_id: i < 5 ? 'dept-01' : 'dept-02' } })).status, 200);
    people.push(person);
  }
  const pick = async (person, choiceId) => call('/api/choices', { method: 'POST', cookie: person.cookie,
    data: { session_id: sid, situation_id: situation.id, choice_id: choiceId, request_key: randomUUID() } });
  for (let i = 0; i < 4; i++) assert.equal((await pick(people[i], situation.choices[0].id)).status, 201);
  const before = await call(path);
  assert.equal(before.status, 200);
  assert.equal(before.body.departments.length, 45);
  const first = before.body.departments.find(d => d.id === 'dept-01');
  assert.equal(first.participant_count, 5);
  assert.equal(first.response_count, 4);
  assert.equal(first.situations[0].respondent_count, 4);
  assert.equal(first.situations[0].suppressed, true);
  assert.equal(first.situations[0].choices, null);
  assert.equal(first.alignment, null);
  assert.equal((await call(path)).body.departments.find(d => d.id === 'dept-02').alignment, null);

  assert.equal((await pick(people[4], situation.choices[1].id)).status, 201);
  const opened = (await call(path)).body.departments.find(d => d.id === 'dept-01');
  assert.equal(opened.situations[0].respondent_count, 5);
  assert.deepEqual(opened.situations[0].choices.map(c => [c.count, c.ratio]), [[4, 0.8], [1, 0.2]]);
  assert.equal(opened.alignment, null);
  assert.equal((await call(`/api/admin/sessions/${sid}/end`, { method: 'POST', admin: true,
    data: { request_key: randomUUID() } })).status, 200);
  const final = (await call(path)).body;
  assert.equal(final.status, 'FINALIZED');
  const finalFirst = final.departments.find(d => d.id === 'dept-01');
  assert.equal(finalFirst.alignment.respondent_count, 5);
  assert.equal(finalFirst.alignment.no_response_count, 0);
  assert.equal(finalFirst.alignment.suppressed, false);
  assert.equal(Object.values(finalFirst.alignment.distribution).reduce((a, b) => a + b, 0), 5);
  const second = final.departments.find(d => d.id === 'dept-02');
  assert.equal(second.participant_count, 1);
  assert.equal(second.alignment.no_response_count, 1);
  assert.equal(second.alignment.suppressed, true);
  assert.equal(second.alignment.distribution, null);
  assert.equal(second.situations[0].choices, null);
  console.log('PASS: 4A public department counts, per-situation denominator, five-person suppression, finalized alignment, no-response count');
}
