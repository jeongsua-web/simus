import type { PoolClient } from "pg";
import { randomInt } from "node:crypto";
import { ApiError, requireOpen, transaction } from "../api";
import { isV002MapVersion, routeBetween, pathLength } from "../city/city-v002-graph.mjs";
import { guidanceMotion, guidancePosition, resumedNpc, returnMotion, type ReturnMotion } from "./npc-graph-motion";
import { NPC_SPEED_MULTIPLIERS, npcPosition, type Npc, type NpcSpeedMultiplier } from "@/app/participate/lib/npc-motion";
import { normalizeEventLocation, type EventLocation } from "../events/event-locations";
import { playableLocation } from "../city/city-v002-event-mapping.mjs";
import { scanPlace } from "./npc-place-trajectory";
import { V003_MAP_VERSION, V003_PATH_VERSION } from "../city/city-builds";
import { localRoute } from "../routes/v003-route";
import { choiceOutcome } from "../routes/v003-local-event";
import { auditedEventRoute, eventArrival, eventReturn, eventTestsEnabled, planEventWalk, type EventWalk } from "../routes/v003-event-routes";
type Point = number[];
type State = {
  waiting_since: Date; motion_epoch: Date; paused_ms: string;
  resume_motion: ReturnMotion | null; guidance_point: Point | null;
  guidance_origin: Point | null; guidance_started_at: Date | null;
  guidance_motion?: (Npc["motion"] & Partial<EventWalk>) | null;
  location_occupancy: Record<string, Occupancy>;
  location_evaluated_at: Date | null; overdue_since: Date | null;
};
type Occupancy = { inside: boolean; entry_seq: number; consumed_entry_seq: number };
type Member = State & {
  participant_id: string; npc_id: string; npc_motion: Npc["motion"];
  profile_completed_at: Date | null;
  active: Event | null;
};
type Situation = {
  id: string; code: string; title: string; body: string; display_order: number;
  event_location: EventLocation | null;
  is_generic: boolean; choices: { id: string; label: string; display_order: number }[];
};
type Event = {
  id: string; situation_id: string; started_at: Date;
  trigger_kind: "LOCATION" | "DEADLINE" | "MANUAL";
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
  const members = await db.query<Member>(`SELECT p.participant_id,p.npc_id,p.npc_motion,p.profile_completed_at,st.*,
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
  if (isOpen(session)) await resumeParkedV003Npcs(db, session, members.rows);
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

function v003PatrolMotion(returnRoute: Npc["motion"]): Npc["motion"] {
  // Reverse the verified return segments. The loop's closing leg reaches the original stop.
  const points = returnRoute.points;
  return { ...returnRoute, points: [...points, ...points.slice(1, -1).reverse()], loop: true };
}

async function resumeParkedV003Npcs(db: PoolClient, session: Session, members: Member[]) {
  const now = timestamp(session.now);
  const updates = members.flatMap(member => {
    const motion = member.resume_motion;
    if (member.active || member.guidance_point || !motion || motion.loop || motion.test_return || motion.speed_mps <= 0 ||
      motion.map_version !== V003_MAP_VERSION || motion.path_version !== V003_PATH_VERSION) return [];
    // Keep progress along an unfinished return, or restart from its endpoint if already parked.
    const returnTime = Math.ceil(pathLength(motion.points) / motion.speed_mps * 1000);
    const epoch = Math.max(timestamp(member.motion_epoch) + Number(member.paused_ms), now - returnTime);
    member.motion_epoch = new Date(epoch);
    member.paused_ms = "0";
    member.resume_motion = v003PatrolMotion(motion);
    return [{
      participant_id: member.participant_id,
      motion_epoch: member.motion_epoch,
      resume_motion: member.resume_motion
    }];
  });
  if (!updates.length) return;
  await db.query(`UPDATE simus.npc_event_states st SET resume_motion=r.resume_motion,
    motion_epoch=r.motion_epoch,paused_ms=0,motion_revision=motion_revision+1
    FROM jsonb_to_recordset($2::jsonb) AS r(participant_id uuid,motion_epoch timestamptz,resume_motion jsonb)
    WHERE st.session_id=$1 AND st.participant_id=r.participant_id`, [session.id, JSON.stringify(updates)]);
}

function transitionFor(world: World, p: Member): Transition | null {
  if (!isOpen(world.session)) return null;
  const now = timestamp(world.session.now);
  const v003 = p.npc_motion.map_version === V003_MAP_VERSION;
  if (v003 && !p.guidance_point) return null;
  if (v003 && p.guidance_motion?.situation_id) {
    if (p.active || !p.guidance_started_at) return null;
    const walk = p.guidance_motion as EventWalk;
    const epoch = timestamp(p.guidance_started_at);
    const arrival = eventArrival(walk, epoch, timestamp(p.location_evaluated_at ?? p.guidance_started_at), now);
    return {
      participant_id: p.participant_id, location_occupancy: p.location_occupancy,
      location_evaluated_at: new Date(arrival ?? now).toISOString(), overdue_since: null,
      ...(arrival === null ? {} : {
        situation_id: walk.situation_id, trigger_kind: "LOCATION", started_at: new Date(arrival).toISOString(),
      }),
    };
  }
  const fresh = world.situations.filter(t => !world.answered.get(p.participant_id)?.has(t.id));
  const places = new Map<string, EventLocation>();
  for (const situation of world.situations) {
    if (v003 && situation.code !== "EXHIBITION_30") continue;
    try {
      const location = normalizeEventLocation(situation.event_location);
      situation.event_location = location;
      if (location.map_version === p.npc_motion.map_version && playableLocation(situation.code, location))
        places.set(location.place_id, location);
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
        state = {
          inside: result.inside, entry_seq: state.entry_seq + result.entries,
          consumed_entry_seq: state.entry_seq + result.entries
        };
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
  const transition: Transition = {
    participant_id: p.participant_id, location_occupancy: atArrival.occupancy,
    location_evaluated_at: new Date(evaluated).toISOString(), overdue_since: overdue === null ? null : new Date(overdue).toISOString()
  };
  if (selected) return {
    ...transition, situation_id: selected.id, trigger_kind: "LOCATION",
    place_id: selected.event_location!.place_id, entry_seq: atArrival.occupancy[selected.event_location!.place_id].entry_seq,
    started_at: new Date(evaluated).toISOString()
  };
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
  if (!v003 && !p.guidance_point && now - timestamp(p.waiting_since) >= 60000 && point && eligible.length) {
    if (isV002MapVersion(p.npc_motion.map_version) && p.npc_motion.speed_mps === 0) return transition;
    const routes = destinations().sort((a, b) => pathLength(a.route) - pathLength(b.route));
    if (!routes.length) return transition;
    const target = routes[0];
    return {
      ...transition, guidance_point: target.situation.event_location!.point, guidance_origin: point,
      ...(isV002MapVersion(p.npc_motion.map_version) ? {
        guidance_motion: guidanceMotion({
          guidance_point: target.situation.event_location!.point, guidance_origin: point,
          guidance_motion: { ...p.npc_motion, points: target.route, loop: false }
        }, p.npc_motion)
      } : {})
    };
  }
  return transition;
}

function motionPhases(p: Member, from: number, to: number) {
  if (p.guidance_point) return [{
    from, to, npc: {
      npc_id: p.npc_id,
      epoch: new Date(p.guidance_started_at!).toISOString(), motion: guidanceMotion(p, p.npc_motion)
    }
  }];
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

type EventOptions = { requestedSpeed?: NpcSpeedMultiplier; startRequestKey?: string; situationId?: string };

export async function advanceEvent(db: PoolClient, sid: string, pid: string, options: EventOptions = {}) {
  const { requestedSpeed, startRequestKey, situationId } = options;
  const testPickerEnabled = eventTestsEnabled();
  if (situationId && !testPickerEnabled)
    throw new ApiError(403, "EVENT_PICKER_DISABLED", "상황 직접 선택은 테스트 모드에서 사용할 수 있습니다.");
  const session = (await db.query<Session>(`SELECT *,clock_timestamp() AS now
    FROM simus.simulation_sessions WHERE id=$1`, [sid])).rows[0];
  const world = await readWorld(db, session, pid);
  if (!world.members.length) throw new ApiError(404, "NOT_JOINED", "이 회차에 먼저 입장해주세요.");
  await applyTransitions(db, world);
  const p = world.members[0];
  const open = isOpen(session);
  const situation = p.active ? world.situations.find(t => t.id === p.active!.situation_id) : null;
  const event = open && p.active && situation ? { ...p.active, situation } : null;
  const outcome = p.active && p.npc_motion.map_version === V003_MAP_VERSION
    ? await choiceOutcome(db, sid, pid, p.active.id) : null;
  const phase = outcome ? "RESULT" : !open ? "CLOSED" : event ? "ACTIVE" : p.guidance_point ? "GUIDING" : "WAITING";
  const v003 = p.npc_motion.map_version === V003_MAP_VERSION;
  let speedMultiplier: NpcSpeedMultiplier | undefined;
  if (phase === "GUIDING" && v003 && p.npc_motion.path_version === V003_PATH_VERSION && p.guidance_started_at) {
    const motion = guidanceMotion(p, p.npc_motion);
    const baseSpeed = localRoute().speed_mps;
    speedMultiplier = NPC_SPEED_MULTIPLIERS.find(value => baseSpeed * value === motion.speed_mps);
    if (requestedSpeed !== undefined && requestedSpeed !== speedMultiplier && motion.speed_mps > 0) {
      const speed = baseSpeed * requestedSpeed;
      const now = timestamp(session.now);
      const elapsed = Math.max(0, now - timestamp(p.guidance_started_at));
      // Keep the same distance along the route and scan future arrivals from the current cursor.
      const epoch = new Date(now - Math.round(elapsed * motion.speed_mps / speed));
      await db.query(`UPDATE simus.npc_event_states SET guidance_started_at=$3, guidance_motion=$4,
        motion_revision=motion_revision+1 WHERE session_id=$1 AND participant_id=$2`,
        [sid, pid, epoch, JSON.stringify({ ...(p.guidance_motion ?? motion), speed_mps: speed })]);
      speedMultiplier = requestedSpeed;
    }
  }
  const plaza = v003 ? world.situations.find(t => t.code === "EXHIBITION_30") : undefined;
  const answered = world.answered.get(pid);
  const plazaCompleted = Boolean(plaza && answered?.has(plaza.id));
  const followUps = v003 ? world.situations.filter(t =>
    /^EXHIBITION_(0[1-9]|[12][0-9])$/.test(t.code) && t.event_location === null && !answered?.has(t.id)) : [];
  const remaining = followUps.length + (plaza && !plazaCompleted ? 1 : 0);
  const route = localRoute();
  const location = plaza?.event_location;
  const expected = route.event_location;
  const plazaReady = location?.map_version === expected.map_version &&
    location.place_id === expected.place_id && location.radius_m === expected.radius_m &&
    JSON.stringify(location.point) === JSON.stringify(expected.point);
  const waitingToStart = v003 && p.npc_motion.path_version === V003_PATH_VERSION &&
    phase === "WAITING" && Boolean(p.profile_completed_at);
  const nextSituation = plazaCompleted ? followUps[0] : plazaReady ? plaza : undefined;
  const testSituations = testPickerEnabled && waitingToStart
    ? [...followUps, ...(plaza && plazaReady && !plazaCompleted ? [plaza] : [])]
    : [];
  const state = {
    ...(outcome ? { outcome } : {}),
    ...(v003 ? { plaza_completed: plazaCompleted, situations_remaining: remaining } : {}),
    ...(testSituations.length ? {
      test_situations: testSituations.map(({ id, code, title }) => ({ id, code, title }))
    } : {}),
    ...(speedMultiplier === undefined ? {} : { speed_multiplier: speedMultiplier }),
    phase, can_start: waitingToStart && Boolean(nextSituation),
    server_time: new Date(session.now).toISOString(), waiting_since: new Date(p.waiting_since).toISOString(),
    deadline_at: null, guidance_at: p.npc_motion.map_version === V003_MAP_VERSION ? null : new Date(timestamp(p.waiting_since) + 60000).toISOString(), event: outcome && p.active && situation ? { ...p.active, situation } : event,
    overdue_since: p.overdue_since?.toISOString() ?? null, overdue: p.overdue_since !== null,
  };
  if (!startRequestKey) return state;

  const request = await db.query(`INSERT INTO simus.npc_event_start_requests(session_id,participant_id,request_key)
    VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING request_key`, [sid, pid, startRequestKey]);
  if (!request.rowCount) return state;
  const picked = situationId ? testSituations.find(t => t.id === situationId) : nextSituation;
  if (situationId && !picked)
    throw new ApiError(409, "TEST_SITUATION_UNAVAILABLE", "지금 시작할 수 있는 미응답 상황을 선택해 주세요.");
  if (phase !== "WAITING") return state;
  if (!waitingToStart || !picked) {
    if (plazaCompleted && !remaining)
      throw new ApiError(409, "EVENTS_EXHAUSTED", "이번 회차의 모든 상황에 응답했습니다.");
    throw new ApiError(409, "EVENT_NOT_READY", "시민 등록과 상황 준비를 확인해주세요.");
  }
  const pickedRoute = situationId ? auditedEventRoute(picked.code) : undefined;
  if (situationId && picked !== plaza && !pickedRoute && !["EXHIBITION_12", "EXHIBITION_26"].includes(picked.code))
    throw new ApiError(409, "EVENT_ROUTE_UNAVAILABLE", "이 상황의 이동 경로가 현재 도시와 일치하지 않습니다.");
  if (picked === plaza || pickedRoute) {
    const now = timestamp(session.now);
    const current = p.resume_motion ? resumedNpc(p, p.npc_motion, now) : {
      npc_id: p.npc_id, epoch: session.now.toISOString(), motion: p.npc_motion,
    };
    const walked = planEventWalk(current, now, picked, pickedRoute ?? { kind: "place", points: route.points });
    const guidance = pickedRoute ? walked : {
      map_version: V003_MAP_VERSION, path_version: V003_PATH_VERSION, points: walked.points, speed_mps: route.speed_mps, loop: false,
    };
    await db.query(`UPDATE simus.npc_event_states SET guidance_origin=$3,guidance_point=$4,
      guidance_motion=$5,guidance_started_at=clock_timestamp(),location_evaluated_at=clock_timestamp(),
      motion_revision=motion_revision+1 WHERE session_id=$1 AND participant_id=$2`,
      [sid, pid, JSON.stringify(guidance.points[0]), JSON.stringify(guidance.points[guidance.points.length - 1]), JSON.stringify(guidance)]);
  } else {
    // Manual situations start at the participant's current pose.
    await db.query(`WITH started AS (
      INSERT INTO simus.npc_events(session_id,participant_id,situation_id,trigger_kind)
      VALUES($1,$2,$3,'MANUAL') RETURNING participant_id
    ) UPDATE simus.npc_event_states SET motion_revision=motion_revision+1
      WHERE session_id=$1 AND participant_id IN (SELECT participant_id FROM started)`, [sid, pid, picked.id]);
  }
  await requireOpen(db, sid);
  return advanceEvent(db, sid, pid);
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
    const route = row.guidance_motion?.situation_id
      ? eventReturn(row.guidance_motion as EventWalk, row.guidance_started_at!, timestamp(row.started_at))
      : original.map_version === V003_MAP_VERSION
      ? v003PatrolMotion({
        ...original, points: [point, ...localRoute().resume_points.slice(1)], speed_mps: localRoute().speed_mps,
      })
      : returnMotion(original, point);
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
