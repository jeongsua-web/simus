# v003 local database verification

2026-11-16. This is a disposable local play environment, not exhibition approval or deployment.

Run from the repository root:

```sh
node scripts/dev/v003-local.mjs
```

Requirements: PostgreSQL binaries at `/opt/homebrew/opt/postgresql@18/bin` (override `V003_PG_BIN`), installed `web/node_modules`, canonical `docs/content/v003-local-route.json` matching its server snapshot, and the actual WebGL deployment under `web/public/unity/city-masterplan-v003-local-v1`. Default web URL is `http://127.0.0.1:3210/v003-test`; PostgreSQL uses loopback port 55443. Optional overrides: `V003_WEB_PORT`, `V003_PG_PORT`.

The runner rejects occupied ports before creating anything. It ignores inherited DATABASE_URL, creates a fresh PostgreSQL cluster in an automatically generated temporary directory, uses database `simus_v003_local`, renders and executes the existing managed init plan, and runs `db/verify_schema.sql`. It then applies the original development demo and exhibition seeds and a guarded DRAFT-only patch. It never applies `seed_development.sql`, rewrites applied migrations, edits a joined membership, or writes to an existing database.

`db/content/city-v003-local-draft.sql` only sets the DRAFT session motion, local session label/end time, clears provisional region map metadata, and places EXHIBITION_30 using the canonical v003 event location. All other 29 locations remain unplaced. The original EXHIBITION_01–30 situation UUIDs, titles, bodies, order and 91 choice UUIDs/text/scores/region effects are compared before and after the patch. No schema migration is required because v003 participant routes use the exact session motion snapshot.

The runner signs a disposable local administrator token and calls the actual session start API, retaining all build/version readiness checks. Only after that API succeeds does it print READY. The private runtime state file (mode 0600) contains the local admin token for independent QA and is kept in the owned temporary directory, not served to the browser. Ctrl+C stops both owned processes. Each invocation creates a new database; completed play data is not reused.

Observed checks:

- Fresh managed migration init through 019 and `db/verify_schema.sql`: passed twice.
- Original 30 situations, 91 choices, UUIDs, scores and region effects preserved: passed.
- Health endpoint returned 200 against the owned database.
- Actual start request rejected with HTTP 409 `CITY_BUILD_UNAVAILABLE` while the v003 WebGL build was absent. This demonstrates the build guard remains active; it is not a successful play verification.

Final successful play and timing evidence is reported by the independent QA report after the actual Unity build is available.

## 2026-11-17 actual WebGL startup

The completed Unity build passed the actual session start API with HTTP 200. The runner printed READY at `http://127.0.0.1:3210/v003-test` using `city-masterplan-v003-local-v1` and `city-masterplan-v003-plaza30-v1`. Managed init, schema verification and preservation of all 30 situations and 91 choices passed again in the fresh owned cluster. Independent QA received the private local state path and the running server.
