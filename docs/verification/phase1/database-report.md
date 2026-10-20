# Phase 1 DB read-only QA

## Result

**Integration readiness: BLOCKED. Schema readiness: FAIL. No database writes were authorized or executed.**

The connected local server configuration contains exactly one simulation session: demo DRAFT `10000000-0000-0000-0000-000000000001`. It has one situation, `TRASH_001`, and its configured NPC map/path are NULL. Exhibition template `16000000-0000-0000-0000-000000000001` and all eight approved EXHIBITION codes are absent. No eligible Phase 1 DRAFT was found.

| Check | Status | Evidence / limit |
|---|---|---|
| Database read-only transaction | PASS | 11 SELECT/catalog queries, `transaction_read_only=on`, ended with ROLLBACK |
| Canonical eight codes ↔ original seed UUIDs | PASS | Static file comparison for 02/05/07/13/17/18/28/30, all eight match |
| Canonical source hashes, exact graph anchors, participant route connectivity | PASS | Read-only preparation tool completed these gates before reaching the DRAFT map/path gate |
| 001–011, 013–014 schema feature markers | PASS | Expected representative catalog objects present; not full migration execution/history/behavior certification |
| 012 execution history | NOT TESTED | Conditional data-only migration; no RUNNING session, no migration-history table observed; execution cannot be inferred |
| 015 live contract | FAIL | `npc_event_states.guidance_motion`, `session_creation_requests.npc_profile`, and `guidance_motion_has_target` absent |
| 016 live contract | FAIL | Five new state/event columns, three new functions, place consistency trigger and entry uniqueness index absent |
| Actual target eight UUIDs | BLOCKED | Target code SELECT returned zero rows; static UUID agreement does not prove live identity |
| DRAFT apply preflight | BLOCKED | Default read-only tool exits 1 with `DRAFT map/path mismatch`; transaction rolled back |
| Migration apply, seed/content preparation, location UPDATE | NOT TESTED | Explicitly prohibited in this QA phase, including isolated DBs |
| DB behavioral tests / `verify_schema.sql` | NOT TESTED | Script performs writes even though it rolls back; therefore not executed |

## Observations and cause inference

Observed: only demo-shaped content exists in this connection. The exhibition seed file still defines the intended 30 situations and the eight prepared UUIDs match that file. This connection does not contain those exhibition rows. The actual 015/016 feature contracts are also unavailable.

Inference: exhibition content has not been retained in this connected database. A seed never applied here, a prior rollback/deletion, or use of a different DB cannot be distinguished from the present read-only snapshot. Do not claim deployment history from these catalog observations. Similarly, missing migration feature objects establish current incompatibility, not historical proof about which commands ran.

## Preparation prerequisites after separate approval

1. Confirm the intended isolated development DB. Do not use the operational session or shared DB for behavioral tests.
2. Review/apply the outstanding numbered migrations through 016 in approved order; never rewrite or re-run already applied migrations. Determine 012 execution history separately because it can touch RUNNING content.
3. Prepare a new exhibition-content DRAFT with the original 30 situation IDs/choices/stats and the new Phase 1 map/path. Preserve existing sessions and their snapshots. This work did not create or modify a DRAFT.
4. Run `db/prepare-phase1-locations.mjs` first in its default READ ONLY mode. It must pass hashes, named anchors, routing, DRAFT map/path, all eight live code/UUID checks and the 016 schema gate.
5. Only after separate write approval, apply the eight locations through that validated tool. Direct psql apply is disabled. The other 22 situations, content wording, choices and stats stay outside this mapping update.
6. Run DB behavioral and integration QA in a separately approved isolated environment before claiming DB readiness.

## Evidence

- `database-read-only-evidence.json`: query text and non-secret parameters, catalog definitions, minimal session/code identifiers, ROLLBACK confirmation and checked-in migration SHA256 values.
- `database-schema-comparison.json`: migration feature-marker comparison, missing columns and readiness classification.
- `database-seed-code-uuid.json`: static canonical-to-seed eight-code UUID comparison.
- `database-preflight-result.json`: exact preparation command, exit code and observed read-only blocking condition.

No credentials, connection URL, participant identity or choice records were collected. Source implementation files were not changed during this QA phase.

## Supplemental clock observation

In one additional `BEGIN READ ONLY` transaction, a MATERIALIZED CTE evaluated two `clock_timestamp()` calls per row for 100,000 generated rows and returned only aggregate counts. No sleep or retry was used. The timestamps landed in the same millisecond for 99,998 rows and different milliseconds for **2 rows**; exact timestamp values differed for 4,122 rows. `transaction_read_only=on` was confirmed and the transaction ended with ROLLBACK. Evidence: `database-clock-select-observation.json`.

**Observed:** two independent clock evaluations can cross a millisecond boundary even in one SELECT row. This supports the possibility behind F1, but is not an UPDATE/choice transaction reproduction, does not prove F1 occurred in an actual participant flow, and does not certify the proposed fix. No DB data changed.
