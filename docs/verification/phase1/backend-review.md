# Phase 1 backend source review

Date: 2026-10-20. Scope: server event policy, trajectory reconstruction, graph
routing, participant projections, and the existing choice ledger. This document
records **source review only**. It does not label runtime behavior PASS. The QA
agent owns the in-memory execution report; the root owns lint/type checks, and
the database agent owns read-only database inspection.

No implementation changes, database writes, migrations, WebGL builds, or
deployment were performed during this review. Only this report was added.

## Finding requiring targeted reproduction

### B1 — Completion uses several clocks and can fabricate an immediate reentry

Priority: potential P1 for the required no-repeat-while-dwelling guarantee.
Status: source-derived failure condition **reproduced by the QA agent's in-memory
execution**. No PostgreSQL UPDATE/choice end-to-end reproduction has been executed. See
`docs/verification/phase1/server-memory-results.json` and
`web/tests/phase1-server-memory.mjs:141`. The QA agent's final run reports 33 cases:
32 passing and one failing clock-skew case; those are its execution results, not this reviewer's
independent runtime verification.

The database agent separately observed different millisecond values in 2 of
100,000 pairs of clock_timestamp evaluations in a read-only SELECT. See
[database-clock-select-observation.json](database-clock-select-observation.json).
This confirms that the clock evaluations can differ; it is not an UPDATE or
choice-flow reproduction, and no database writes were performed.

Evidence: `web/src/lib/npc-events.ts:272` sets motion_epoch in one UPDATE.
Lines 275–278 then call clock_timestamp separately for waiting_since,
location_evaluated_at, and pause duration. JavaScript/pg dates are read at
millisecond precision. `npc-place-trajectory.ts:90` uses the old inside state,
and lines 110–113 count a subsequently crossed entry boundary. The event scheduler
considers that a new entry (`npc-events.ts:115–141`).

Concrete state illustrating the clock boundary:

1. Use a one-dimensional 1 m/s route starting at x=0, with a place centered at
   x=2, radius 1. The first entry occurs at t=1000 ms, x=1, and freezes there.
2. Complete the choice with location_evaluated_at rounded to C=10000 ms but the
   later clock used for pause duration rounded to D=10001 ms.
3. Pause duration becomes D−1000=9001 ms. The resumed route at cursor C is x=0.999,
   outside the place, while persisted occupancy still says inside=true.
4. A sweep from C to C+1 ms crosses x=1 again. It can create a second unanswered
   situation at the same place even though the intended resume pose was x=1 and
   there was no intended departure.

This is a deterministic arithmetic illustration, not a PostgreSQL runtime result.
At the actual configured 2.38 m/s speed, the analogous one-millisecond discrepancy
is 2.38 mm. Earliest-arrival freezes can lie this close to the radius boundary.

The QA agent executed the unchanged advanceEvent/completeEvent implementation in
an in-memory SQL harness with a 0→10 m loop, speed 1 m/s, place x=5/radius 1.
The first event began at 4000 ms. After completion at 10000 ms, modelling the later
pause clock as +1 ms changed paused_ms from 6000 to 6001 while the cursor stayed
10000. Polling at 10001 created a second event at the same place. Its assertion
failed with `2 !== 1`. This demonstrates the state-machine failure under a 1 ms
clock skew; it does not measure real PostgreSQL frequency or scheduling.

Required correction: capture one completion timestamp and use a
consistent millisecond representation for waiting_since, location_evaluated_at,
motion_epoch, and paused_ms. Preserve the exact frozen pose across completion;
do not repair the symptom by ignoring genuine later exits/reentries. Changes to
implementation require separate authorization in the current review stage.

## Source observations — not runtime PASS

| Requirement | Source evidence | What still requires execution |
|---|---|---|
| New occurrences are LOCATION only | `npc-events.ts:140–143` supplies the only new trigger kind; the old DEADLINE selection branches are absent | Exercise 90+ seconds before arrival and inspect occurrences |
| Actual path during polling gaps | `npc-place-trajectory.ts:17–68` creates ordered arc-length intervals; :101–117 counts loop entries; `npc-events.ts:166–176` splits a return handoff | Verify multiple graph corners, loop seam, long gap, and return handoff |
| Earliest-entry freeze | `npc-events.ts:130–143` selects the first arriving millisecond; `participant-npcs.ts:54–60` projects event pose as speed zero | Compare frozen point with graph and 3D radii in runtime snapshots |
| One event while dwelling | `npc-events.ts:110–124` persists inside and consumes entry sequences; :134 chooses one situation; 016 unique index limits the same entry | Reconnect, duplicate reads, same-place many situations, completion clock boundary B1 |
| Position/event agreement | `participant-npcs.ts:28` reconciles event state before projecting positions | Real endpoint concurrency and browser interpolation |
| 60-second guidance | `npc-events.ts:151–161` chooses reachable unoccupied places and stores graph guidance | Reach all approved anchors and return after answering |
| Overdue monitoring | `npc-events.ts:136–139` records waiting_since + 90 sec, :276 clears on completion | Late arrival, restart persistence, and ACTIVE/CLOSED responses |
| Choice/stat idempotency | `choices/route.ts:18–29` locks and checks replay/ownership; :42–78 writes ledgers and completes in one transaction | PostgreSQL constraints, rollback, concurrent submissions, and real stats totals |
| Legacy preservation | Per-map graph router retains old graph; old ACTIVE occurrences remain readable, new location-less content is inactive | Old-running-session compatibility after migration 016 |

The existing choice route has not been rewritten. Its replay check precedes
effects, active occurrence ownership is checked under the session lock, the city
version and effect ledgers are written in the same transaction, and requireOpen
is checked again after completeEvent. These are code properties, not evidence of
an executed database idempotency test.

## Explicit precision and deployment limits

- `npc-place-trajectory.ts:93–97` rounds a crossing to a representable millisecond
  and requires the position to remain inside. A tangent-only or submillisecond
  contact can therefore increment occupancy entry counts without creating an
  occurrence. The API accepts any positive radius, so unrestricted “100% of all
  valid radii/speeds” is not established. This is already documented in the event
  contract; the approved multi-meter anchors require their own runtime evidence.
- A fractional `rejoin_after_ms` is used to split phases, while Npc epochs become
  ISO strings at millisecond precision (`npc-events.ts:169–175`,
  `npc-graph-motion.ts:14–19`). Tiny connector/original-loop pose discrepancies need
  targeted execution. No claim of exact submillisecond continuity is made.
- Backdated arrival detection can correct an extrapolated browser pose on its next
  snapshot. It does not establish that the browser never rendered past a place
  before that snapshot.
- The source requires migration 016. It remains unapplied in this review stage.
  No actual database unique constraint, trigger, or permission behavior was tested
  by this reviewer.

## Recommended disposition

Do not approve deployment or claim full location-entry QA based on this source
review. Obtain the QA agent's execution report for policy, same-place behavior,
and B1; keep real-database ledger/concurrency verification and actual WebGL/browser
arrival rendering explicitly pending until authorized.
