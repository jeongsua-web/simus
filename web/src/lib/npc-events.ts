import type { PoolClient } from "pg";
import { randomInt } from "node:crypto";
import { ApiError, transaction } from "./api";
import { isV002MapVersion, routeBetween, pathLength } from "./city-v002-graph.mjs";
import { guidanceMotion, guidancePosition, resumedNpc, returnMotion, type ReturnMotion } from "./npc-graph-motion";
import { npcPosition, type Npc } from "@/app/participate/npc-motion";
import { parseEventLocation, type EventLocation } from "./event-locations";
import { scanPlace } from "./npc-place-trajectory";

type Point = number[];
type State = {
  waiting_since: Date; motion_epoch: Date; paused_ms: string;
  resume_motion: ReturnMotion | null; guidance_point: Point | null;
  guidance_origin: Point | null; guidance_started_at: Date | null;
  guidance_motion?: Npc["motion"] | null;
  location_occupancy: Record<string, Occupancy>;
  location_evaluated_at: Date | null; overdue_since: Date | null;
};
type Occupancy = { inside: boolean; entry_seq: number; consumed_entry_seq: number };
type Member = State & {
  participant_id: string; npc_id: string; npc_motion: Npc["motion"];
  active: Event | null;
};
type Situation = {
  id: string; code: string; title: string; body: string; display_order: number;
  event_location: EventLocation | null;
  is_generic: boolean; choices: { id: string; label: string; display_order: number }[];
};
type Event = {
  id: string; situation_id: string; started_at: Date;
  trigger_kind: "LOCATION" | "DEADLINE";
  place_id?: string | null; entry_seq?: string | null;
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
  started_at?: string; guidance_point?: Point; guidance_origin?: Point; guidance_motion?: Npc["motion"];
  place_id?: string; entry_seq?: number;
  location_occupancy: Record<string, Occupancy>; location_evaluated_at: string; overdue_since: string | null;
};
const timestamp = (value: Date | string) => new Date(value).getTime();
const pick = <T,>(items: T[]): T | undefined => items.length ? items[randomInt(items.length)] : undefined;
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
    (session_id,participant_id,waiting_since,motion_epoch,location_evaluated_at)
    SELECT session_id,participant_id,joined_at,joined_at,joined_at FROM simus.participant_sessions
    WHERE session_id=$1 AND ($2::uuid IS NULL OR participant_id=$2)
    ON CONFLICT DO NOTHING`, [session.id, participant ?? null]);
  const members = await db.query<Member>(`SELECT p.participant_id,p.npc_id,p.npc_motion,st.*,
    CASE WHEN e.id IS NULL THEN NULL ELSE to_jsonb(e) || jsonb_build_object('entry_seq',e.entry_seq::text) END AS active
    FROM simus.participant_sessions p JOIN simus.npc_event_states st USING(session_id,participant_id)
    LEFT JOIN simus.npc_events e ON e.session_id=p.session_id
      AND e.participant_id=p.participant_id AND e.status='ACTIVE'
    WHERE p.session_id=$1 AND ($2::uuid IS NULL OR p.participant_id=$2)`,
  [session.id, participant ?? null]);
  // Runtime routes can adjust speed while the joined motion snapshot stays immutable.
  for (const member of members.rows) {
    if (member.resume_motion) member.npc_motion = { ...member.npc_motion, speed_mps: member.resume_motion.speed_mps };
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
  if (!isOpen(world.session)) return null;
  const now = timestamp(world.session.now);
  const fresh = world.situations.filter(t => !world.answered.get(p.participant_id)?.has(t.id));
  const places = new Map<string, EventLocation>();
  for (const situation of world.situations) {
    try {
      const location = parseEventLocation(situation.event_location);
      if (location.map_version === p.npc_motion.map_version) places.set(location.place_id, location);
    } catch { /* Legacy unplaced content remains inactive until explicitly mapped. */ }
  }
  const until = p.active ? Math.min(now, timestamp(p.active.started_at)) : now;
  // Legacy rows have no historical entry cursor: establish occupancy at the
  // current pose rather than replaying motion predating this policy.
  const from = Math.min(until, p.location_evaluated_at ? timestamp(p.location_evaluated_at) : until);
  const scan = (end: number) => {
    const occupancy: Record<string, Occupancy> = Object.assign(Object.create(null), p.location_occupancy);
    const entered = new Map<string, number>();
    for (const [id, location] of places) {
      let state = { ...(occupancy[id] ?? { inside: false, entry_seq: 0, consumed_entry_seq: 0 }) };
      for (const phase of motionPhases(p, from, end)) {
        const result = scanPlace(phase.npc, phase.from, phase.to, location, state.inside);
        if (result.firstEntry !== null && !entered.has(id)) entered.set(id, result.firstEntry);
        if (!Number.isSafeInteger(state.entry_seq + result.entries))
          throw new ApiError(409, "EVENT_ENTRY_LIMIT", "장소 진입 횟수의 지원 범위를 초과했습니다.");
        state = { inside: result.inside, entry_seq: state.entry_seq + result.entries,
          consumed_entry_seq: state.entry_seq + result.entries };
      }
      occupancy[id] = state;
    }
    return { occupancy, entered };
  };
  const scanned = scan(until);
  const eligible = fresh.filter(t => t.event_location && places.has(t.event_location.place_id));
  const arrivals = p.active ? [] : eligible.filter(t => scanned.entered.has(t.event_location!.place_id));
  const firstArrival = arrivals.length ? Math.min(...arrivals.map(t => scanned.entered.get(t.event_location!.place_id)!)) : null;
  // Millisecond timestamps are rounded into the arriving interval, never before it.
  const evaluated = firstArrival === null ? until : Math.min(until, Math.ceil(firstArrival));
  const atArrival = firstArrival === null ? scanned : scan(evaluated);
  const selected = pick(arrivals.filter(t => Math.ceil(scanned.entered.get(t.event_location!.place_id)!) === evaluated &&
    atArrival.occupancy[t.event_location!.place_id]?.inside));
  const overdue = p.overdue_since ? timestamp(p.overdue_since) :
    !p.active && evaluated >= timestamp(p.waiting_since) + 90000 ? timestamp(p.waiting_since) + 90000 : null;
  const transition: Transition = { participant_id: p.participant_id, location_occupancy: atArrival.occupancy,
    location_evaluated_at: new Date(evaluated).toISOString(), overdue_since: overdue === null ? null : new Date(overdue).toISOString() };
  if (selected) return { ...transition, situation_id: selected.id, trigger_kind: "LOCATION",
    place_id: selected.event_location!.place_id, entry_seq: atArrival.occupancy[selected.event_location!.place_id].entry_seq,
    started_at: new Date(evaluated).toISOString() };
  if (p.active) return transition;
  const npc = resumedNpc(p, p.npc_motion, now);
  const point = p.guidance_point ? guidancePosition(p, p.npc_motion, now) : npcPosition(npc, now);
  const routeTo = (target: Point) => {
    if (!point) return null;
    try { return isV002MapVersion(p.npc_motion.map_version) ? routeBetween(point, target, p.npc_motion.map_version) : [point, target]; }
    catch { return null; } // Off-graph or disconnected locations cannot create a chord.
  };
  const destinations = () => eligible.filter(t => !atArrival.occupancy[t.event_location!.place_id]?.inside)
    .map(t => ({ situation: t, route: routeTo(t.event_location!.point) }))
    .filter((t): t is { situation: Situation; route: Point[] } => t.route !== null);
  if (!p.guidance_point && now - timestamp(p.waiting_since) >= 60000 && point && eligible.length) {
    if (isV002MapVersion(p.npc_motion.map_version) && p.npc_motion.speed_mps === 0) return transition;
    const routes = destinations().sort((a, b) => pathLength(a.route) - pathLength(b.route));
    if (!routes.length) return transition;
    const target = routes[0];
    return { ...transition, guidance_point: target.situation.event_location!.point, guidance_origin: point,
      ...(isV002MapVersion(p.npc_motion.map_version) ? { guidance_motion: guidanceMotion({ guidance_point: target.situation.event_location!.point, guidance_origin: point,
        guidance_motion: { ...p.npc_motion, points: target.route, loop: false } }, p.npc_motion) } : {}) };
  }
  return transition;
}

function motionPhases(p: Member, from: number, to: number) {
  if (p.guidance_point) return [{ from, to, npc: { npc_id: p.npc_id,
    epoch: new Date(p.guidance_started_at!).toISOString(), motion: guidanceMotion(p, p.npc_motion) } }];
  const epoch = timestamp(p.motion_epoch) + Number(p.paused_ms);
  const resume = p.resume_motion;
  const handoff = resume?.rejoin_after_ms === undefined ? null : epoch + resume.rejoin_after_ms;
  if (handoff !== null && resume?.rejoin_motion && handoff > from && handoff <= to) return [
    { from, to: handoff, npc: { npc_id: p.npc_id, epoch: new Date(epoch).toISOString(), motion: resume } },
    { from: handoff, to, npc: { npc_id: p.npc_id, epoch: new Date(handoff).toISOString(), motion: resume.rejoin_motion } },
  ];
  return [{ from, to, npc: resumedNpc(p, p.npc_motion, from) }];
}

async function applyTransitions(db: PoolClient, world: World) {
  const transitions = world.members.map(p => transitionFor(world, p)).filter(t => t !== null);
  const updates = transitions.filter(t => {
    const p = world.members.find(p => p.participant_id === t.participant_id)!;
    return p.location_evaluated_at?.toISOString() !== t.location_evaluated_at ||
      (p.overdue_since?.toISOString() ?? null) !== t.overdue_since || JSON.stringify(p.location_occupancy) !== JSON.stringify(t.location_occupancy);
  });
  if (updates.length) {
    await db.query(`UPDATE simus.npc_event_states st SET location_occupancy=r.location_occupancy,
      location_evaluated_at=r.location_evaluated_at,overdue_since=r.overdue_since
      FROM jsonb_to_recordset($2::jsonb) AS r(participant_id uuid,location_occupancy jsonb,
        location_evaluated_at timestamptz,overdue_since timestamptz)
      WHERE st.session_id=$1 AND st.participant_id=r.participant_id`, [world.session.id, JSON.stringify(updates)]);
    for (const t of updates) {
      const p = world.members.find(p => p.participant_id === t.participant_id)!;
      p.location_occupancy = t.location_occupancy;
      p.location_evaluated_at = new Date(t.location_evaluated_at);
      p.overdue_since = t.overdue_since === null ? null : new Date(t.overdue_since);
    }
  }
  const events = transitions.filter(t => t.situation_id);
  const guidance = transitions.filter(t => t.guidance_point);
  if (events.length) {
    const inserted = await db.query<Event & { participant_id: string }>(`
      INSERT INTO simus.npc_events(session_id,participant_id,situation_id,trigger_kind,started_at,place_id,entry_seq)
      SELECT $1,r.participant_id,r.situation_id,r.trigger_kind,r.started_at,r.place_id,r.entry_seq
      FROM jsonb_to_recordset($2::jsonb) AS r(participant_id uuid,situation_id uuid,
        trigger_kind text,started_at timestamptz,place_id text,entry_seq bigint) RETURNING *`, [world.session.id, JSON.stringify(events)]);
    await db.query(`UPDATE simus.npc_event_states SET motion_revision=motion_revision+1
      WHERE session_id=$1 AND participant_id=ANY($2::uuid[])`,
    [world.session.id, inserted.rows.map(e => e.participant_id)]);
    for (const e of inserted.rows) world.members.find(p => p.participant_id === e.participant_id)!.active = e;
  }
  if (guidance.length) {
    await db.query(`UPDATE simus.npc_event_states st SET guidance_point=r.guidance_point,
      guidance_origin=r.guidance_origin,guidance_motion=r.guidance_motion,guidance_started_at=$3,motion_revision=motion_revision+1
      FROM jsonb_to_recordset($2::jsonb) AS r(participant_id uuid,guidance_point jsonb,guidance_origin jsonb,guidance_motion jsonb)
      WHERE st.session_id=$1 AND st.participant_id=r.participant_id`,
    [world.session.id, JSON.stringify(guidance), world.session.now]);
    for (const t of guidance) {
      const member = world.members.find(p => p.participant_id === t.participant_id)!;
      member.guidance_point = t.guidance_point!;
      member.guidance_origin = t.guidance_origin!;
      member.guidance_motion = t.guidance_motion ?? null;
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
    overdue_since: p.overdue_since?.toISOString() ?? null, overdue: p.overdue_since !== null,
  };
}

// Position snapshots reconcile the same authoritative event state before rendering,
// so a missed timer tick cannot let a snapshot run past an unprocessed arrival.
export async function syncNpcEvents(db: PoolClient, sid: string, pid?: string) {
  const session = (await db.query<Session>(`SELECT *,clock_timestamp() AS now
    FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE`, [sid])).rows[0];
  if (!session || !isOpen(session)) return;
  const world = await readWorld(db, session, pid);
  await applyTransitions(db, world);
}

export function guidedPoint(state: Pick<State, "guidance_origin" | "guidance_point" | "guidance_started_at">,
  speed: number, now: number): Point {
  const origin = state.guidance_origin!, target = state.guidance_point!;
  const length = Math.hypot(...target.map((n, i) => n - origin[i]));
  const mix = length ? Math.min(1, Math.max(0, now - timestamp(state.guidance_started_at!)) / 1000 * speed / length) : 1;
  return target.map((n, i) => origin[i] + (n - origin[i]) * mix);
}

export async function completeEvent(db: PoolClient, sid: string, pid: string, eid: string) {
  const row = (await db.query<Member & { started_at: Date }>(`SELECT st.*,p.npc_motion,e.started_at
    FROM simus.npc_event_states st JOIN simus.participant_sessions p USING(session_id,participant_id)
    JOIN simus.npc_events e ON e.id=$3 WHERE st.session_id=$1 AND st.participant_id=$2`, [sid, pid, eid])).rows[0];
  if (row.guidance_point) {
    const original = { ...row.npc_motion, speed_mps: row.resume_motion?.speed_mps ?? row.npc_motion.speed_mps };
    const point = guidancePosition(row, original, timestamp(row.started_at));
    const route = returnMotion(original, point);
    await db.query(`UPDATE simus.npc_event_states SET resume_motion=$3,motion_epoch=clock_timestamp(),paused_ms=0
      WHERE session_id=$1 AND participant_id=$2`, [sid, pid, JSON.stringify(route)]);
  }
  await db.query(`UPDATE simus.npc_event_states st SET waiting_since=clock_timestamp(),
    overdue_since=NULL,location_evaluated_at=clock_timestamp(),
    motion_revision=motion_revision+1,paused_ms=CASE WHEN st.guidance_point IS NOT NULL THEN 0
      ELSE st.paused_ms+floor(extract(epoch FROM(clock_timestamp()-e.started_at))*1000)::bigint END,
    guidance_point=NULL,guidance_origin=NULL,guidance_started_at=NULL,guidance_motion=NULL
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
