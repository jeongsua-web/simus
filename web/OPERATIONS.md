# Participation and operations guide

## Participant flow

1. Open `/` and choose **참여 시작하기**.
2. `/participate` creates or reuses the anonymous HttpOnly participant credential, loads the current round, then loads the participant's own response records.
3. A successful response remains completed after refresh because `/api/sessions/{id}/responses` returns only `situation_id`, `choice_id`, and `received_at`. It never returns alignment, score, delta, or city impact columns.
4. A network or 5xx failure retains the original round, request key and selected choice in localStorage, including across reloads and round changes. The retry button replays that exact submission. A definite client rejection clears the pending request.
5. The screen distinguishes response completed, admission closed, result preparation (`CLOSING`), and final confirmation (`FINALIZED`).
6. `/result/{session_id}` calls the personal result API only after the response-status API reports `FINALIZED`. Before that point, personal score and alignment are neither requested nor rendered.
7. An invalid server-side credential returns 401 and is shown as expired authentication. A browser with no credential receives a new anonymous identity. No available current or prior participated round is shown as an empty state.

## Administrator flow

1. Configure `ADMIN_TOKEN_ISSUER`, `ADMIN_TOKEN_AUDIENCE`, and exactly one of `ADMIN_JWKS_URL` or `ADMIN_JWKS_JSON`. The JWT subject must match an active `simus.admin_users.auth_subject`.
2. Open `/admin`, paste the Bearer JWT, and choose **운영 화면 열기**. It is stored in `sessionStorage`, so closing the tab removes the UI session.
3. `GET /api/admin/sessions` verifies JWT signature/claims and active-admin membership on the server before returning any list data. Start and end handlers repeat the same checks.
4. A draft card lists each start blocker: missing regions/situations/choices, invalid rules or numeric effects, stale runtime data, invalid time, or another active round. **회차 시작** is enabled only when the server returns `can_start: true`.
5. During a running round, choose **수동 종료**. The confirmation names the round and states that admission closes immediately and finalization starts. Confirm with **대상 회차 종료**.
6. Buttons remain disabled while a mutation is running. The request uses a fresh idempotency key, surfaces server errors, and reloads the server state. `CLOSING` rounds poll every three seconds until `FINALIZED`.

The **다음 회차 준비** form clones a DRAFT or FINALIZED content snapshot with a name, duration, and impact scale. It does not copy responses or results. Duration starts at the actual start action. Individual content editing remains unavailable. See [the integration guide](../docs/operations/stage4-8-integration.md).

## Local validation

For a fresh isolated PostgreSQL cluster, concurrent API flows, server/database recovery,
and optional Chromium UI tests, see [the integration report](../docs/verification/integration-report.md).
After building, `npm run test:integration` creates its own test database and stops its
owned services at the end; it does not use the development database.

From `web/`:

```sh
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

Database integration tests require a disposable PostgreSQL database initialized with `db/001_initial_schema.sql`, `db/002_session_lifecycle.sql`, `db/003_session_creation.sql`, and the relevant seed. Never point them at development or production data:

```sh
TEST_API_URL=http://localhost:3101 TEST_DATABASE_URL=postgresql://.../disposable_test_db node tests/api.integration.mjs
TEST_API_URL=http://localhost:3101 TEST_DATABASE_URL=postgresql://.../disposable_test_db node tests/session-lifecycle.integration.mjs
```
