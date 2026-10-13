import type { PoolClient } from "pg";
import { ApiError, transaction } from "./api";
import { npcPosition, type Npc } from "@/app/participate/npc-motion";

type Point = number[];
type State = {
  waiting_since: Date; motion_epoch: Date; paused_ms: string;
  resume_motion: Npc["motion"] | null; guidance_point: Point | null;
  guidance_origin: Point | null; guidance_started_at: Date | null;
};
type Member = State & {
  participant_id: string; npc_id: string; npc_motion: Npc["motion"];
  active: Event | null;
};
type Situation = {
  id: string; code: string; title: string; body: string; display_order: number;
  event_location: { map_version: string; point: Point; radius_m: number } | null;
  is_generic: boolean; choices: { id: string; label: string; display_order: number }[];
};
type Event = {
  id: string; situation_id: string; started_at: Date;
  trigger_kind: "LOCATION" | "DEADLINE";
};
type Session = {
  id: string; now: Date; status: string; admission_closed_at: Date | null;
  starts_at: Date; scheduled_end_at: Date;
  admission_buffer: { hours?: number; minutes?: number; seconds?: number };
};
type World = {
  session: Session; members: Member[]; situations: Situation[];
  answered: Map<string, Set<string>>;
};
type Transition = {
  participant_id: string; situation_id?: string; trigger_kind?: string;
  started_at?: string; guidance_point?: Point; guidance_origin?: Point;
};
const distance = (a: Point, b: Point) => Math.hypot(...a.map((n, i) => n - b[i]));
const timestamp = (value: Date | string) => new Date(value).getTime();
function isOpen(s: Session) {
  const buffer = s.admission_buffer;
  const cutoff = timestamp(s.scheduled_end_at) -
    ((buffer.hours ?? 0) * 3600 + (buffer.minutes ?? 0) * 60 + (buffer.seconds ?? 0)) * 1000;
  return s.status === "RUNNING" && !s.admission_closed_at &&
    timestamp(s.now) >= timestamp(s.starts_at) && timestamp(s.now) < cutoff;
}

// Session locks serialize this snapshot with membership, choices and lifecycle changes.
// Four batched reads replace per-NPC content and history queries.
async function readWorld(db: PoolClient, session: Session, participant?: string): Promise<World> {
  await db.query(`INSERT INTO simus.npc_event_states
    (session_id,participant_id,waiting_since,motion_epoch)
    SELECT session_id,participant_id,joined_at,joined_at FROM simus.participant_sessions
    WHERE session_id=$1 AND ($2::uuid IS NULL OR participant_id=$2)
    ON CONFLICT DO NOTHING`, [session.id, participant ?? null]);
  const members = await db.query<Member>(`SELECT p.participant_id,p.npc_id,p.npc_motion,st.*,
    CASE WHEN e.id IS NULL THEN NULL ELSE to_jsonb(e) END AS active
    FROM simus.participant_sessions p JOIN simus.npc_event_states st USING(session_id,participant_id)
    LEFT JOIN simus.npc_events e ON e.session_id=p.session_id
      AND e.participant_id=p.participant_id AND e.status='ACTIVE'
    WHERE p.session_id=$1 AND ($2::uuid IS NULL OR p.participant_id=$2)`,
  [session.id, participant ?? null]);
  // A ticker pass has no work when every participant is waiting for a decision.
  if (!participant && members.rows.every(p => p.active)) {
    return { session, members: members.rows, situations: [], answered: new Map() };
  }
  const situations = await db.query<Situation>(`SELECT t.*,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'label',c.label,
      'display_order',c.display_order) ORDER BY c.display_order,c.id)
      FROM simus.session_choices c WHERE c.session_id=t.session_id
      AND c.situation_id=t.id),'[]'::jsonb) AS choices
    FROM simus.session_situations t WHERE session_id=$1 ORDER BY display_order,id`, [session.id]);
  const history = await db.query<{ participant_id: string; situation_id: string }>(`
    SELECT DISTINCT participant_id,situation_id FROM simus.choice_records
    WHERE session_id=$1 AND ($2::uuid IS NULL OR participant_id=$2)`, [session.id, participant ?? null]);
  const answered = new Map<string, Set<string>>();
  for (const r of history.rows) {
    if (!answered.has(r.participant_id)) answered.set(r.participant_id, new Set());
    answered.get(r.participant_id)!.add(r.situation_id);
  }
  return { session, members: members.rows, situations: situations.rows.filter(t => t.choices.length), answered };
}

function transitionFor(world: World, p: Member): Transition | null {
  if (p.active || !isOpen(world.session)) return null;
  const now = timestamp(world.session.now);
  const fresh = world.situations.filter(t => !world.answered.get(p.participant_id)?.has(t.id));
  const npc: Npc = { npc_id: p.npc_id, epoch: new Date(p.motion_epoch).toISOString(),
    motion: p.resume_motion ?? p.npc_motion };
  const point = p.guidance_point ? guidedPoint(p, p.npc_motion.speed_mps, now) :
    npcPosition(npc, now - Number(p.paused_ms));
  const eligible = fresh.filter(t => t.event_location?.map_version === p.npc_motion.map_version);
  let selected = eligible.find(t => point && distance(t.event_location!.point, point) <= t.event_location!.radius_m);
  let trigger_kind = now - timestamp(p.waiting_since) >= 90000 ? "DEADLINE" : "LOCATION";
  if (!selected && now - timestamp(p.waiting_since) >= 90000) {
    selected = fresh.find(t => t.is_generic) ?? world.situations.find(t => t.is_generic);
    trigger_kind = "DEADLINE";
  }
  if (selected) return {
    participant_id: p.participant_id, situation_id: selected.id, trigger_kind,
    // Keep actual delivery/pose time honest; deadline_at separately records the target.
    started_at: new Date(world.session.now).toISOString(),
  };
  if (!p.guidance_point && now - timestamp(p.waiting_since) >= 60000 && point && eligible.length) {
    eligible.sort((a, b) => distance(a.event_location!.point, point) - distance(b.event_location!.point, point));
    return { participant_id: p.participant_id, guidance_point: eligible[0].event_location!.point, guidance_origin: point };
  }
  return null;
}

async function applyTransitions(db: PoolClient, world: World) {
  const transitions = world.members.map(p => transitionFor(world, p)).filter(t => t !== null);
  const events = transitions.filter(t => t.situation_id);
  const guidance = transitions.filter(t => t.guidance_point);
  if (events.length) {
    const inserted = await db.query<Event & { participant_id: string }>(`
      INSERT INTO simus.npc_events(session_id,participant_id,situation_id,trigger_kind,started_at)
      SELECT $1,r.participant_id,r.situation_id,r.trigger_kind,r.started_at
      FROM jsonb_to_recordset($2::jsonb) AS r(participant_id uuid,situation_id uuid,
        trigger_kind text,started_at timestamptz) RETURNING *`, [world.session.id, JSON.stringify(events)]);
    await db.query(`UPDATE simus.npc_event_states SET motion_revision=motion_revision+1
      WHERE session_id=$1 AND participant_id=ANY($2::uuid[])`,
    [world.session.id, inserted.rows.map(e => e.participant_id)]);
    for (const e of inserted.rows) world.members.find(p => p.participant_id === e.participant_id)!.active = e;
  }
  if (guidance.length) {
    await db.query(`UPDATE simus.npc_event_states st SET guidance_point=r.guidance_point,
      guidance_origin=r.guidance_origin,guidance_started_at=$3,motion_revision=motion_revision+1
      FROM jsonb_to_recordset($2::jsonb) AS r(participant_id uuid,guidance_point jsonb,guidance_origin jsonb)
      WHERE st.session_id=$1 AND st.participant_id=r.participant_id`,
    [world.session.id, JSON.stringify(guidance), world.session.now]);
    for (const t of guidance) {
      const member = world.members.find(p => p.participant_id === t.participant_id)!;
      member.guidance_point = t.guidance_point!;
      member.guidance_origin = t.guidance_origin!;
      member.guidance_started_at = world.session.now;
    }
  }
}

export async function advanceEvent(db: PoolClient, sid: string, pid: string) {
  const session = (await db.query<Session>(`SELECT *,clock_timestamp() AS now
    FROM simus.simulation_sessions WHERE id=$1`, [sid])).rows[0];
  const world = await readWorld(db, session, pid);
  if (!world.members.length) throw new ApiError(404, "NOT_JOINED", "이 회차에 먼저 입장해주세요.");
  await applyTransitions(db, world);
  const p = world.members[0];
  const open = isOpen(session);
  const situation = p.active ? world.situations.find(t => t.id === p.active!.situation_id) : null;
  const event = open && p.active && situation ? { ...p.active, situation } : null;
  return {
    phase: !open ? "CLOSED" : event ? "ACTIVE" : p.guidance_point ? "GUIDING" : "WAITING",
    server_time: new Date(session.now).toISOString(), waiting_since: new Date(p.waiting_since).toISOString(),
    deadline_at: new Date(timestamp(p.waiting_since) + 90000).toISOString(), event,
  };
}

export function guidedPoint(state: Pick<State, "guidance_origin" | "guidance_point" | "guidance_started_at">,
  speed: number, now: number): Point {
  const origin = state.guidance_origin!, target = state.guidance_point!;
  const length = distance(target, origin);
  const mix = length ? Math.min(1, Math.max(0, now - timestamp(state.guidance_started_at!)) / 1000 * speed / length) : 1;
  return target.map((n, i) => origin[i] + (n - origin[i]) * mix);
}

export async function completeEvent(db: PoolClient, sid: string, pid: string, eid: string) {
  const row = (await db.query<Member & { started_at: Date }>(`SELECT st.*,p.npc_motion,e.started_at
    FROM simus.npc_event_states st JOIN simus.participant_sessions p USING(session_id,participant_id)
    JOIN simus.npc_events e ON e.id=$3 WHERE st.session_id=$1 AND st.participant_id=$2`, [sid, pid, eid])).rows[0];
  if (row.guidance_point) {
    const original = row.npc_motion;
    const point = guidedPoint(row, original.speed_mps, timestamp(row.started_at));
    const points = original.points;
    let nearest = 0;
    points.forEach((p, i) => { if (distance(p, point) < distance(points[nearest], point)) nearest = i; });
    const route = [point, ...points.slice(nearest), ...(original.loop ? points.slice(0, nearest) : [])];
    await db.query(`UPDATE simus.npc_event_states SET resume_motion=$3,motion_epoch=clock_timestamp(),paused_ms=0
      WHERE session_id=$1 AND participant_id=$2`, [sid, pid, JSON.stringify({ ...original, points: route })]);
  }
  await db.query(`UPDATE simus.npc_event_states st SET waiting_since=clock_timestamp(),
    motion_revision=motion_revision+1,paused_ms=CASE WHEN st.guidance_point IS NOT NULL THEN 0
      ELSE st.paused_ms+floor(extract(epoch FROM(clock_timestamp()-e.started_at))*1000)::bigint END,
    guidance_point=NULL,guidance_origin=NULL,guidance_started_at=NULL
    FROM simus.npc_events e WHERE st.session_id=$1 AND st.participant_id=$2 AND e.id=$3`, [sid, pid, eid]);
  await db.query(`UPDATE simus.npc_events SET status='COMPLETED',completed_at=clock_timestamp() WHERE id=$1`, [eid]);
}

export async function reconcileNpcEvents() {
  return transaction(async db => {
    const sessions = await db.query<Session>(`SELECT *,clock_timestamp() AS now
      FROM simus.simulation_sessions WHERE status='RUNNING' ORDER BY id FOR UPDATE`);
    let participants = 0;
    for (const session of sessions.rows) {
      if (!isOpen(session)) continue;
      const world = await readWorld(db, session);
      await applyTransitions(db, world);
      participants += world.members.length;
    }
    return { participants };
  });
}
