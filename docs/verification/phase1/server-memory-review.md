# Phase 1 server trajectory QA (in-memory runtime)

Date: 2026-10-20. Result: **32 PASS / 1 FAIL**, executing unchanged production TypeScript functions against an in-memory SQL port. This is neither static-only review nor PostgreSQL integration verification.

Command: `cd web && node tests/phase1-server-memory.mjs`

Evidence: [machine-readable results and source hashes](server-memory-results.json). The command exits 1 because the failing requirement remains reproducible. No product source was changed.

## Blocking finding: completion clock skew can synthesize a second entry

`web/src/lib/npc-events.ts:275` updates the completion cursor and paused duration with separate `clock_timestamp()` expressions. Those expressions can observe different instants. A one millisecond difference between the cursor and reconstructed motion produces a synthetic outside-to-inside crossing at the boundary of a place that the NPC has not actually left.

Executed reproduction in `web/tests/phase1-server-memory.mjs`, test named `completion clock expressions separated by 1 ms must not create synthetic reentry`:

1. Motion follows `[0,0,0]` to `[10,0,0]` and back, speed 1 m/s. Two unanswered situations share place `[5,0,0]`, radius 1 m.
2. Poll at 5,000 ms. The production scheduler freezes the first event at 4,000 ms, position `[4,0,0]`, entry sequence 1.
3. Complete at 10,000 ms. The fixture executes the production `completeEvent` function. Its SQL port sets cursor to 10,000 ms and paused duration to 6,000 ms.
4. Model the later `clock_timestamp()` expression by making paused duration 6,001 ms while retaining the cursor at 10,000 ms. This models separate SQL clock reads; it does not claim a real database timing measurement.
5. Poll at 10,001 ms. The production trajectory scans from reconstructed position 3.999 m to 4.000 m and creates a second event for the same place, entry sequence 2.

Expected: one event while remaining at the same frozen place. Actual: two events. The unchanged production scheduler fails this invariant for the modeled state. The frequency and exact expression timing of this state in PostgreSQL remain untested because database writes and migrations were not authorized.

Before approval, the owning implementation should use a coherent completion instant for motion/cursor calculations and preserve occupancy continuity. No fix is included in this QA work.

## Executed runtime coverage

- All eight canonical Phase 1 locations: actual graph route from campus plaza, earliest millisecond entry, frozen pose inside both Euclidean and graph radius, repeated polling without duplication. These are route-math checks, not Unity physical access checks.
- Poll-gap pass-through, a narrow radius crossed 100 times across a long loop gap, loop seam handling, whole-loop occupancy, ordered corner traversal and submillisecond tangent exclusion.
- Same-place situations: one event per entry, no chaining while inside, exit/reentry allows a different unanswered situation, answered situations do not repeat.
- Simultaneous overlapping places consume the same arrival together; earliest eligible place wins independent of situation array order.
- Initial inside occupancy, legacy null cursor without historical replay, ACTIVE freeze without future entries, consumed entry without eligible content, safe integer overflow rejection.
- 60-second guidance including nearest graph destination and exclusion of an occupied consumed place; 90 seconds records overdue without DEADLINE creation. Unlocated generic and wrong-map content cannot create events.
- Overdue persists through ACTIVE polling and clears on completion. Stored legacy DEADLINE occurrences remain readable and completable.
- Future start, DRAFT, FINALIZED, admission close and cutoff return CLOSED without event creation.
- Graph zero-speed and off-graph targets cannot fabricate guidance. Graph guidance/return connector completion and fractional handoff retain graph membership and continuous positions.
- Location schema and conflicting shared place geometry validation.

## Explicitly blocked or unverified

- PostgreSQL migration/schema application, SQL syntax/constraint evaluation, unique keys, transaction rollback and concurrent session locking: **NOT RUN**. No PostgreSQL connection was created. A fake constraint in the SQL fixture is not proof of a database constraint.
- Actual choice endpoint authorization, request-key replay and city/region/alignment stat ledger exactly-once effects: **NOT RUN**. The harness marks answers in memory solely to exercise scheduler and completion behavior.
- Real restart persistence, concurrent HTTP requests, authentication/cookies and Next.js route handlers: **NOT RUN**. Reconnection coverage means repeated production function calls over retained in-memory state.
- Unity collision/grounding, trigger-object clearance, WebGL rendering/build contents and mobile performance: outside this artifact.
- Types/lint are owned by the root QA task and were not duplicated here.

The test harness uses TypeScript transpilation in memory, unchanged server sources, the actual graph module/data, and a deliberately narrow simulated SQL port. Its evidence records source hashes. It never imports `pg`, creates a real pool, runs a migration or connects to a database. No exhibition approval or physical accessibility claim follows from these results.
