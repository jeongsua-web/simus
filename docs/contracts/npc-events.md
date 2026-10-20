# NPC location events — Phase 1

New occurrences are **LOCATION only**. The server must observe an actual entry
into a configured place on the participant's authoritative route. There is no
90-second fallback, teleport, unlocated-content selection, or generated-greeting
selection. Existing DEADLINE occurrences and choice records remain unchanged.

## Places and entries

`event_location` is `{place_id,map_version,point:[x,y,z],radius_m}`. Place IDs use
the same 1–128 character format as map versions. Every situation sharing a place
ID in one session must share the exact map, point, and radius. New PUT requests
require place_id; legacy locations without it remain stored but cannot generate
new events until explicitly configured in a DRAFT. Starting a session validates
place IDs, shared geometry, map compatibility, and v002 graph membership.

The server checks both 3D distance and graph travel distance against the radius.
Movement is reconstructed along the ordered graph edges between evaluations;
corners are never replaced by a straight chord. Loop crossings use periodic
distance arithmetic, including return-connector handoff to the original route.
The earliest eligible entry freezes the NPC at its arrival time. Position APIs
reconcile this same state before returning a snapshot. Delayed polling can still
display an old extrapolated pose until the next snapshot; no client render is
treated as authority. Crossing times use millisecond precision: submillisecond
tangent-only contact is not promoted into an event outside the radius.

Migration 016 adds durable `location_evaluated_at`, `location_occupancy`, and
`overdue_since`. Each occupancy entry is
`{inside,entry_seq,consumed_entry_seq}`. The first evaluation treats an NPC already
inside a place as entry 1. Only one situation is chosen for an entry, randomly
among eligible situations at the earliest arrival. Simultaneous/overlapping
entries are consumed together. Remaining inside cannot produce another situation,
including after completion or reconnect. Exiting and reentering allows a new
entry and a different unanswered situation. Movement during a poll gap is included,
so an exit and reentry need not coincide with a polling sample. Answered situations
never repeat for the same participant/session. Entries with no eligible content
are consumed without an event.

New event-state rows start their trajectory cursor at joined_at. Existing state
rows with a null cursor establish occupancy at their current authoritative pose;
the new policy does not replay their earlier movement history.

New `npc_events` store `place_id` and bigint `entry_seq` (serialized as a decimal
string in API occurrences). A database unique key prevents a second occurrence
for the same session/participant/place/entry. The existing one-ACTIVE-occurrence
constraint remains in force. Active NPCs are evaluated at their frozen pose, and
an entry during an active occurrence cannot queue another event.

## Waiting, guidance, and overdue monitoring

At 60 seconds, the server guides an NPC along the graph toward the nearest
reachable place with unanswered content. A consumed place the NPC still occupies
is excluded. It continues moving until an actual entry; reaching 90 seconds does
not create any occurrence. The threshold is recorded as `overdue_since` on the
next evaluation, survives reconnect, and is cleared by successful choice completion.
`deadline_at` remains `waiting_since + 90 seconds` for API compatibility and is a
monitoring threshold, not an occurrence deadline.

`GET /api/sessions/{id}/event` adds `overdue:boolean` and
`overdue_since:string|null`. Existing phases remain WAITING/GUIDING/ACTIVE/CLOSED.
An ACTIVE occurrence retains an already recorded overdue value until completion.
The immutable content, membership motion, and city/region/alignment choice ledger
are reused. Choice submission, event completion, motion revision, waiting-clock
reset and stats remain one transaction under the session lock.

## Deployment boundary

Apply migration 016 before deploying the new server. Existing ACTIVE events can
still be completed, including legacy DEADLINE events; the new scheduler never
creates another DEADLINE. Shared place geometry is protected in DRAFT configuration.
Phase 1 mappings are separate DRAFT data; no running/finalized content or original
30 situation bodies, choices, or effect values are rewritten. The default v002
session creation profile now uses the separate Phase 1 map/path. The previous graph
and build route are preserved for existing membership snapshots. A Phase 1 session
requires its matching map/path and a newly built matching WebGL manifest.

Phase 1 uses server trajectory entry detection; it adds no Unity collider or
PLACE_ENTER bridge message. Participant identity, event authority and statistics
remain on the authenticated server. No credentials are sent to Unity.

Migration 016 is prepared but **not applied**. The authorized change does not
execute migrations, QA, WebGL builds, or deployment. Those remain subject to
separate user approval.
