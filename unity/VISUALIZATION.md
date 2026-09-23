# SIM:US city visualization MVP

The visualization is generated at runtime from Unity primitives and built-in shaders. It does not require a paid asset or a scene file tied to one Unity Editor version.

## Server values and visual mapping

Unity displays server values as received. It never calculates city scores, participant scores, aggregate pollution, lifecycle status, or result finality.

| API field | HUD | City expression | Range mapping |
| --- | --- | --- | --- |
| `happiness` | Numeric value | Building height | `0` = 72% base height, `100` = 122% base height |
| `safety` | Numeric value | Four central safety lights | Linear dark gray to warm yellow over `0..100` |
| `cleanliness` | Numeric value | Central ground color | Linear brown-gray to green over `0..100` |
| `overall_pollution` | Numeric value or `N/A` | Central translucent haze | Opacity `0..0.48` and radius `5..7` over `0..100`; `null` shows `N/A` and no haze target |
| `regions[].pollution` | Region color/effect | District ground and plume | `0` green, `50` amber, `100` red; plume size `0.2..1.9` and opacity `0.08..0.70` |

Targets change immediately when a valid snapshot arrives. Rendered values interpolate toward the target over 1.2 seconds by default. This smoothing changes presentation only; HUD values are the same interpolated presentation values and no result is written back to the server.

Regions are keyed by API `code`, falling back to API `id` only when a code is empty. Array position is never used for identity. A new `session_id` destroys every old region object and resets interpolation state before the new round is created. Regions removed within a session are destroyed.

The HUD distinguishes:

- `city_state: null`: `NO ROUND`
- `RUNNING`: `ROUND IN PROGRESS`
- `CLOSING`: `FINALIZING RESULTS`
- `FINALIZED`: `RESULTS FINALIZED`
- first connection, connected, reconnecting, disconnected with the last good state, paused, and configuration error

## Scene and preview

1. Open the `unity/` directory as a Unity project after an Editor version and `ProjectSettings/` have been established.
2. Open or create an empty scene.
3. Choose **SIMUS > Create Preview City**, enter Play Mode, and inspect the three test districts (`18`, `47`, and `82` pollution), the four HUD metrics, and lifecycle label.
4. For live data, remove the preview object and choose **SIMUS > Create City Client**. Set `Server Base Url` on `City State Poller` when the API is not `http://localhost:3000`.
5. Start the Next.js API and enter Play Mode. A valid response updates the generated city. Stop the API to see `RECONNECTING`, then `DISCONNECTED — SHOWING LAST STATE`; restart it to see `CONNECTED`.
6. Use **Window > General > Test Runner > EditMode > Run All** for JSON/store/polling and visual mapping tests.

`CityClientBootstrap` also creates the live client automatically in an empty scene. The menu is useful when the endpoint or polling settings need inspector configuration.

## Verification limits in this checkout

The repository now contains `ProjectSettings/ProjectVersion.txt` for Unity 6000.3.24f1 and an imported static Neighborhood scene. The existing API visualization has not yet been recompiled or run in the Editor after this merge. Its preview path provides deterministic visual test data for that check.
