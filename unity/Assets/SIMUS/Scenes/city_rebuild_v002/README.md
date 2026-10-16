# CityRebuild v002 — working scene

## Phase 4–7 continuation

Open `CityRebuild_v002.unity` directly. The original scene and build selection are preserved. The current scene includes the park, river and graph navigation additions; the Phase 1–3 notes below are historical, not the current feature list. Use `1` for overview, `2` for top view and `F` for NPC follow.

Continue with `CityRebuildV002Completion.Prepare` and `CityRebuildV002Phase47Bridge.RunBatch` for incremental preparation and actual Play Mode verification. Do not use the full Phase 1–3 generator or the old Phase 4 apply command on this river scene: they rebuild earlier content. Preparation preserves the existing river graph and restores prop FBX axis rotations without editing source models. Runtime evidence, captures and limitations are tracked in [Phase 7 QA](../../../../../docs/verification/city-rebuild-v002-phase7-qa.md). A file's existence alone does not establish that its last test passed.

The approved base graph remains 388 nodes / 409 edges; the river extension currently brings it to 572 / 597. These are scene-local test routes, not a finalized exhibition map version or event-location dataset. Existing MoveTowards, grounding, animation and 90-second event wait behavior are retained. NavMesh and actual doorway access require separate evidence from exterior approach-node traversal.

## Phase 4 river addition (2026-10-15)

The eastern park now includes the river addition described in [the river design](../../../../../docs/planning/city_rebuild_v002/river-design.md). Use `SIMUS > City Rebuild v002 > Apply Phase 4 River` for its incremental generator. The hierarchy `12_River_Phase4` owns the excavated bed/banks, independent water surface, two bank trails, two bridges, connecting ramps and graph extension. `CityGround` and `EastPark_Lawn` reference carved scene-only meshes. Do not run the Phases 1–3 generator to edit this addition: it replaces the entire city root.

Select `River_Water_Surface` and its `CityV002RiverWater` component to inspect the water appearance. Disable `followCityState` for a manual test, then set `pollution` from 0 (clean) to 100 (polluted), or call `SetPollution(float)`. With `followCityState` enabled at runtime, an available `CityStatePoller` city aggregate takes priority, then `CityStateAssets.pollution`; without either source the local value remains. Unknown server regions are not guessed. Renderer property blocks keep the shared material unchanged.

The water width is fixed at 10m, the bank corridor is 24m and the two riverside trails are 2.4m wide. Water width changes require a new clearance check: a 12m water width intersects a neighboring existing pedestrian envelope. The layout JSON/CSVs, buildings, roads and exhibition identifiers remain separate protected inputs. See [river QA](../../../../../docs/verification/city-rebuild-v002-river-qa.md) for final verification scope and remaining limitations.

## Original Phase 1–3 handoff

The following records the original handoff before subsequent park and river additions.

Open `CityRebuild_v002.unity` in Unity 6000.3.24f1. The scene is assembled in Unity from the approved `docs/planning/city_rebuild_v002/layout.json`; the CSV placement tables are cross-checked by the independent QA checker. The earlier 2×2 draft is not used.

The generated hierarchy separates ground, seven roads, six intersection asphalt meshes, turning spaces, pedestrian surfaces, seventeen crossing facility groups, fourteen campus buildings, retained campus facilities and fifty-five external buildings. Campus wrappers reference actual meshes/materials in the existing Campus FBX, with the original world geometry preserved and only the four approved per-building deltas applied. External buildings remain actual FBX prefab instances with measured footprint-centre/ground corrections in their child model transforms. Building proxies are not used.

The original scene, NPC model/animation/controller, camera script and build selection remain protected. This scene contains the existing local `TestNpcPatrol` camera test on a short campus walking segment. It has **no graph navigation integration**, baked NavMesh, changed event logic or exhibition map identifier. The existing 90-second event wait contract is unchanged.

The menu `SIMUS > City Rebuild v002 > Build Phases 1 to 3` regenerates the `CityRebuild_v002` root, including generated road meshes and materials, from the approved layout. Edits under this generated root are replaced on regeneration; other roots in this new scene are retained. This does not regenerate the original follow scene or alter the build settings. `Capture Editor Inspection Views` produces static Unity Editor renders, independently of Play Mode verification.

The pedestrian graph provides physical sidewalk, building approach, campus path, residential alley and park trail surfaces only. City ground is Y=−0.02 m below the retained campus surface to avoid coplanar overlap and preserve support beyond its irregular silhouette. Raised paths use Y=0.14 m, carriageways Y=0.02 m and crossings flush markings Y=0.023 m. Intersection asphalt is cut from the roads into separately editable objects. Same-height road/path/marking overlaps are removed by convex polygon subtraction. Seventeen facility groups are not seventeen ordinary zebra crossings: they implement the approved facility/corridor list without adding a stripe object for every graph crossing edge. Traffic signalling, accessible kerb ramps, door thresholds and NavMesh connections await subsequent phases.

Actual entrances are **not yet certified accessible**. Blender inspection finds several provisional `local -Z` design directions differ from existing door/ramp geometry: houses have +Z entrances; Villa 01/02 and Apartment A include +X entries. The approved placement/yaw is retained for review. The generated approach paths are planned exterior anchors, and real doorway-to-anchor connection/threshold tests remain outstanding. See the Blender findings and Unity/QA reports under `docs/verification/`.

The city-wide/top-view sizes in this new scene are enlarged for static inspection; follow pitch/yaw/size are preserved. The original runtime camera has a 170-unit scroll clamp, so complete city-wide runtime framing remains a Phase 6 task. Use `1` for overview, `2` for top view and `F` for the existing local NPC follow feature. Runtime navigation, dynamic occlusion, FPS/CPU/memory tests and park modules/props are not completion claims for this Phase 3 handoff.
