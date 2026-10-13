// Scoring/lifecycle regression fixtures explicitly create an occurrence. Timing,
// location and authorization use the real scheduler in npc-events.integration.
import { createHash, randomUUID } from 'node:crypto';

export async function fixtureSituation(pool, sid) {
  return (await pool.query(`SELECT t.*, COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'label',c.label) ORDER BY c.display_order,c.id)
    FROM simus.session_choices c WHERE c.session_id=t.session_id AND c.situation_id=t.id),'[]'::jsonb) AS choices
    FROM simus.session_situations t WHERE t.session_id=$1 ORDER BY display_order,id LIMIT 1`, [sid])).rows[0];
}

export async function prepareChoice(pool, env, cookie, data) {
  if (data.event_id) return;
  const value = /simus_participant=([a-f0-9]{64})/.exec(cookie ?? '')?.[1];
  if (!value) { data.event_id = randomUUID(); return; }
  const hash = createHash('sha256').update(value).digest('hex');
  const person = (await pool.query('SELECT participant_id FROM simus.participant_credentials WHERE token_hash=$1', [hash])).rows[0];
  if (!person) { data.event_id = randomUUID(); return; }
  const pid = person.participant_id;
  const prior = (await pool.query('SELECT event_id FROM simus.choice_records WHERE session_id=$1 AND participant_id=$2 AND request_key=$3', [data.session_id,pid,data.request_key])).rows[0];
  if (prior) { data.event_id = prior.event_id; return; }
  const joined = await fetch(`${env.TEST_API_URL}/api/sessions/${data.session_id}/join`, { method:'POST', headers:{ cookie } });
  if (!joined.ok) { data.event_id = randomUUID(); return; }
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT id FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE', [data.session_id]);
    const event = (await db.query('SELECT id FROM simus.npc_events WHERE session_id=$1 AND participant_id=$2 AND situation_id=$3 ORDER BY started_at DESC LIMIT 1', [data.session_id,pid,data.situation_id])).rows[0];
    if (event) data.event_id = event.id;
    else {
      await db.query(`INSERT INTO simus.npc_event_states(session_id,participant_id,waiting_since,motion_epoch)
        SELECT session_id,participant_id,joined_at,joined_at FROM simus.participant_sessions WHERE session_id=$1 AND participant_id=$2 ON CONFLICT DO NOTHING`, [data.session_id,pid]);
      data.event_id = (await db.query(`INSERT INTO simus.npc_events(session_id,participant_id,situation_id,trigger_kind)
        VALUES($1,$2,$3,'LOCATION') RETURNING id`, [data.session_id,pid,data.situation_id])).rows[0].id;
    }
    await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}
