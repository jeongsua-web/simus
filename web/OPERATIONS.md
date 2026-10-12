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

## Result links and web push (4B candidate)

Apply DB migrations `007_result_links.sql` and `008_web_push.sql` after 006. Configure stable `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (a real `mailto:` or HTTPS contact). Generate the key pair once with `npx web-push generate-vapid-keys --json` and keep the private key in server secrets. Web push needs HTTPS in deployment. The existing authenticated reconcile scheduler must continue calling `POST /api/internal/sessions/reconcile` after finalization to dispatch queued notifications. Each call processes at most 20 jobs; inspect `simus.push_jobs` for failures and measure throughput at the planned audience size. Do not put VAPID secrets in `NEXT_PUBLIC_` variables.

Participant result links are 30-day, read-only bearer credentials. The user creates one from their finalized result screen and can copy it to another device. A new link replaces the old one. The shared result API should have ingress-level request throttling before external release. iPhone web push requires the Home Screen web app; a Safari tab and Home Screen app may have separate participant storage, so same-person linking remains an acceptance blocker. See [4B status](../docs/contracts/result-notification-4b.md).

## Unity WebGL preview

`/unity` embeds the actual `CompletedMapNpcFollow` scene from `/unity-preview/index.html`.
The home page links to it. This standalone preview uses the candidate university map
and a test character; it does not identify the authenticated participant or change session data.
`/participate` keeps the separate `/city` bridge and its map/NPC validation. A confirmed
map version and participant paths are required before connecting that production flow.

Build with Unity's **SIMUS → WebGL → Build NPC follow preview** menu (or
`NpcFollowWebGLBuild.Build` in batch mode), then deploy from `web/`:

```sh
npm run unity:deploy -- ../unity/Builds/npc_follow_preview
npm run build
npm run start
```

The deploy command accepts only an uncompressed standalone preview with its `build.json`,
loader, framework, wasm and data files. It stages the complete directory before switching
it into `public/unity-preview`, preserves previous builds in `.unity-deploy-backups`, and
never deploys to `/city`. Include the generated public directory with the website deployment.
The preview manifest records `map_version: null` and `exhibition_ready: false`; it does not
establish a final exhibition map. Runtime progress/errors and a three-minute loading timeout
provide loading and retry states. Next serves preview assets with cache revalidation.

Actual runtime browser check (requires a deployed preview and a running web server):

```sh
TEST_API_URL=http://127.0.0.1:3124 TEST_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/unity-preview.mjs
```

2026-10-12 verification: the actual uncompressed Unity build was deployed and tested
in Chromium at 390px and 1280px. Canvas rendering, runtime READY, reload, missing-build
error/retry, cache revalidation and absence of page errors passed. Screenshots after the
startup splash confirmed buildings and the followed test NPC. The existing Unity debug
HUD has clipped control text on the narrow viewport; phone hardware performance and
exhibition UI acceptance remain untested. Deploy before starting Next, or restart it after
adding new public files so the server includes them in its static file inventory.

## Local validation commands

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
