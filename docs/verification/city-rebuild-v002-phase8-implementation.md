# City Rebuild v002 Phase 8 A/B — Unity implementation

This records implementation scope; final PASS/FAIL requires the latest Phase 8 runtime, transition, physics, building audit, EditMode XML and independent QA results.

The existing scene is the working scene. Its Phase 7 copy and camera settings are preserved in `city-rebuild-v002-phase8-baseline/`. Existing building transforms, mesh references, collider shapes, pedestrian graph and light/pipeline settings are retained. New geometry is under `13_Phase8_VisualPolish`; it has no colliders.

## Camera

Actual same-location apartment comparisons are in `city-rebuild-v002-phase8-captures/before/`. Distance/angle alone still left large apartment facades on screen. The selected framing combines orthographic size 21, pitch 48°, yaw −36°, torso aperture radius 4.2m and optional nearby-building context fade (9m context radius, 5% dither coverage). Road, sidewalk and parking context is visible in the final apartment capture; the person is approximately 25 pixels tall at 1920×1080. This is a reviewable framing improvement, not proof of readability from every city location.

`CityPreviewCamera.smoothFollowTransitions` is enabled only in this scene. Acquisition pans with SmoothDamp (0.6s, maximum 40m/s), rotates at up to 20°/s and eases orthographic size with maximum 120 units/s. The acquisition clock resets when Follow is requested and uses actual elapsed time, capped at 1/30s per pose step, so prior screenshot/readback work cannot cause a first-frame jump. Continuous follow retains 0.35s smoothing. Existing scenes default to the previous acquisition behavior. The Phase 8 runtime measures stationary target switches in real time, waits for acquisition to settle before captures and route containment checks, and writes separate `phase8-after-transitions.json` evidence from LateUpdate after the camera, including the first visible step.

Reveal materials remain runtime copies. Whole-building fade restores when no target is followed, when the reveal component is disabled and when it is destroyed. Other material property-block values are retained. The default shader context visibility is 1, preserving other scenes.

## City visuals

Scene-local variants cover 211 original materials; no imported material source is changed. The palette uses muted slate asphalt, warm pavement, cream details, blue-grey roofs and restrained green lawns. Actual Game camera review corrected an initially overbright palette. The park district overlay was removed after the first attempt visibly covered the excavated river.

Nine decorative mesh groups add centerline dashes, road edge lines, turning-head end markings, commercial frontage panels, paved U-striped parking courts, building lawns and plaza paving. There are 121 new street-kit instances: 66 planters, 45 lamps (no Light components), 10 benches. Placement checks reserve complete graph edge widths plus clearance and avoid building/road envelopes and existing tall colliders. The source kit was made and reimported in Blender independently; existing Blender/FBX originals were preserved.

The river retains its existing geometry, bridge collision, water shader/material and pollution component. Only clean/polluted endpoint colors change. Runtime-only clean=0 and polluted=100 screenshots restore the previous pollution and follow-state values afterward. Actual bank-trail and bridge physics is audited separately.

## Validation boundaries

The initial failed Phase 8 attempt is preserved under `city-rebuild-v002-phase8-attempts/attempt-01/`. It exposed the river overlay issue and a verification fixture that sampled a cloned actor before BeginRoute initialized its position; these failures are not reused as PASS evidence. The corrected fixture initializes each route before creating its monitor, avoiding an artificial cross-city teleport.

Phase 8 C lighting/environment and D profiling/performance are deferred for user review. No new FPS comparison is claimed. Door thresholds, NavMesh, production event/backend integration, crowd avoidance and every possible continuous camera line of sight remain outside this run's proof.
