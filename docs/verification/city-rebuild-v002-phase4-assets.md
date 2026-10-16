# City rebuild v002 — Phase 4 asset handoff

Approved `docs/planning/city_rebuild_v002/layout.json` remains the placement authority. This audit reuses the prior Blender world measurements, Phase 1–3 FBX audit, campus importer map and entry evidence. It does not revise the city plan or save/export any Blender source. No source asset, FBX or `.meta` was changed by this audit.

## Existing park and vegetation assets

| Use | Existing Unity path under `Assets/SIMUS/Art/` | Placement / measured size |
|---|---|---|
| PM1 | `vegetation/parks/COZY_NEIGHBORHOOD_PARK.fbx` | X=140, Z=25, yaw=0, scale=1; 12×12m, source height 4.654m |
| PM2 | `vegetation/parks/MODERN_MINIMAL_PARK.fbx` | X=142, Z=118, yaw=0, scale=1; 12×12m, source height 3.831m |
| Tree | `props/city_state_v001/models/POL_TREE_HEALTHY_01.fbx` | Geometry local dimensions approximately 2.683×2.552×4.688m in Blender X/Y/Z |
| Bench | `props/city_state_v001/models/SAF_BENCH_NORMAL_01.fbx` | Geometry local dimensions approximately 1.800×0.568×0.973m |
| Alternate tree | `props/props/STREET_TREE.fbx` | Existing tree export, model scale approximately 1.0143 |
| Alternate bench | `props/props/REUSED_BENCH.fbx` | Existing bench export, 840 vertices |

Tree/bench city-state manifest entries are `received`, with prior 1m FBX reimport/Unity loading evidence. Their use does not raise exhibition approval status. The two park file stems have no individual manifest key in the approved measurement dataset; their file existence and inventory entry alone are not approval evidence. The user approved their placement through the v002 layout.

The approved park boundary has 11 vertices and forms the east green belt. Rest areas are PZ01=(140,25), radius 6m and PZ02=(142,118), radius 7m. Module scale must remain 1; do not enlarge a 12m module to cover the entire park.

## Important FBX hierarchy and origin result

The source `.blend` measurements counted 205 PM1 meshes and 93 PM2 meshes. The actual FBX exports each contain **one merged mesh**:

- PM1 model `UNITY_ASSET_COZY_NEIGHBORHOOD_PARK`, geometry `R02_UNITY_MESH_COZY_NEIGHBORHOOD_PARK`, 17,460 vertices.
- PM2 model `UNITY_ASSET_MODERN_MINIMAL_PARK`, geometry `R02_UNITY_MESH_MODERN_MINIMAL_PARK`, 5,768 vertices.

Their binary FBX model translation is (0,0.300000012,0), rotation approximately (90,0,180), UnitScaleFactor=100. Geometry local bounds have X/Y ±6 and local Z min −0.300000012. Apply the existing proven axis adapter and Unity imported bounds when anchoring; raw binary transforms are not already Unity transforms. Changing individual child renderer visibility cannot select park foliage because each export is merged.

The city-state tree/bench models encode scale=(100,100,100) and UnitScaleFactor=1; their geometry dimensions remain metres after importer unit compensation. Do not manually multiply Unity scale by 100 based on the raw binary value. Confirm loaded Unity world bounds and use a wrapper to ground them.

Paths crossing module interiors require special obstacle checks. All have width 2.5m:

| Edge | Approved centerline |
|---|---|
| `PKE06_S0` | (166,30) → (140,25), ending at PM1 center |
| `PKE07_S0` | (140,25) → (114,2), starting at PM1 center |
| `REST_2_LINK_S0` | (142,118) → (165,100), starting at PM2 center |

A full module collider can include trees, benches and deck elevations across these lines. Successful world support rays alone do not prove the route avoids a prop. Unity must test support plus the moving NPC's body clearance. If separation is needed, produce a new derivative export from the existing source; do not overwrite the original. No derivative was required or created at this handoff stage.

## White pedestrian surfaces

`CityRebuildV002Setup.Build` creates each approved pedestrian edge as a `MeshFilter`/`MeshRenderer` plus `MeshCollider` under `04_PedestrianSurfaces`. The light sidewalk and campus materials therefore render **real pedestrian meshes**, rather than merely graph debug lines. The layout edge points drive their geometry. Improving material colour or mesh joins can preserve the existing graph node/edge contract. Park paths already use their own brown `park_trail` material.

## 500 units triangle warning

The real current Unity log at `/Users/jeongsua/Library/Logs/Unity/Editor.log:1435` identifies **Source mesh name: CityGround**. The warning is from the generated ground collider, not a building FBX:

> Detected one or more triangles where the distance between any 2 vertices is greater than 500 units.

The generator adds 8m around the approved extent (420×435m), creating a 436×451m quad and two fan triangles. Each triangle includes the **627.293m** diagonal. Tessellating CityGround into 25–50m grid cells preserves the exact extent and height while reducing the longest edge below 500m. No Blender export change is needed. Unity must recook the resulting collider and inspect its new execution log before marking the warning resolved.

## Entry evidence for Phase 5

The existing [external entry evidence](city-rebuild-v002-external-entry-evidence.csv) contains all 55 placements and identifies 39 provisional local −Z approach conflicts. These are source-geometry directional candidates, not verified portals:

- Houses 01/02/03: source ramp evidence faces +Z.
- Villa 01/02: accessible-entry evidence faces +X.
- Villa 03: accessible entry at +X/−Z corner.
- Apartment A (B15/B18): entry-glass plane suggests +X.

Use the existing CSV's projected candidates to locate real door/ramp geometry in Unity, then test exterior clearance and connections. Keep the approved building placement/yaw and layout graph; record necessary implementation-only access connectors separately. Reaching a proxy point does not establish reaching the actual door. A ramp AABB does not prove outward normal, doorstep traversal or interior access. Campus's 487-name mapping and measured entry glass/steps are already available in the Phase 1–3 audit; no repeat Blender run is needed.

## Executed checks and limits

`python3 scripts/assets/audit_city_rebuild_v002_phase4.py` completed successfully. It uses only Python's standard library to read six existing binary FBX files and writes [metadata evidence](city-rebuild-v002-phase4-fbx-metadata.json). Both park FBX SHA-256 values match the approved asset measurements. This is binary metadata inspection, **not a Blender/Unity import or Play Mode success claim**.

| Item | Status | Evidence |
|---|---|---|
| Park files exist and match approved measurement hashes | PASS | Metadata JSON, both hash matches true |
| Actual merged park FBX hierarchy identified | PASS | One Mesh Model/Geometry per file |
| Existing tree and bench exchange files located | PASS | Four FBX metadata reads, two manifest entries |
| Warning source and oversized triangle cause identified | PASS | Real Editor log + 627.293m generated quad diagonal |
| Source save/export or original modification | Not performed | Read-only Python audit; no Blender run |
| Unity park import/material/placement | NOT TESTED by this audit | Unity implementation agent owns execution |
| Park path obstacle clearance / actual door access | NOT TESTED by this audit | Requires runtime physics/NPC checks |
| Warning disappearance after new mesh cook | NOT TESTED by this audit | Requires fresh Unity execution log |

Catalog generation/check is coordinated by the main agent after all Unity scene assets settle, avoiding simultaneous inventory writes. This audit adds documentation and one inspection script; it does not alter logical asset registration or approval status.

## 2026-10-16 Phase 4 resume — asset verification

This continuation inspected the existing saved city and the river work already present in the working tree. No Blender source, export, importer metadata, GUID, original scene or building placement was edited by this asset audit. The Unity specialist owns the incremental scene corrections and fresh execution evidence. No Blender re-export is necessary for the issues below.

The six binary FBX files listed above were **read again**, using the existing `read_fbx` implementation without calling its report-writing `main()`. All six current SHA-256 values match the existing [metadata evidence](city-rebuild-v002-phase4-fbx-metadata.json). Mesh/vertex counts remain PM1 1/17,460, PM2 1/5,768, city-state tree 1/26, city-state bench 1/120, street tree 1/26 and reused bench 1/840. This establishes current binary readability and unchanged geometry, not fresh Blender import or Unity Play Mode success.

The current `Campus.fbx` SHA-256 also matches [the prior source-to-FBX map](city-rebuild-v002-campus-fbx-map.json). The saved city has actual `MeshFilter.m_Mesh` references to that FBX GUID `db95cddf399db4b02837fe4bb12a675e` for `Sports_field`, `Basketball_court`, `Tennis_court` and `Tennis_net`. These facilities are existing FBX meshes copied into editable scene objects; their reuse does not depend on introducing proxy boxes or repeating Blender conversion.

### Tree orientation and missing benches found at resume

Before the Unity specialist's new Apply, the saved scene contains **58 street-tree prefab instances and zero reused-bench prefab instances**. This matches the earlier Phase 4 report's 32 park + 14 campus + 12 roadside trees and `additional_benches=0`. The original park modules may contain bench-shaped connected parts, but this does not prove that recognizable benches survived the pedestrian-clearance extraction. The earlier assembly PASS is therefore insufficient evidence for completing the bench requirement. The revised Phase 4 code requires at least two independently placed actual bench FBXs; its execution and current scene result must be checked separately.

The old `TryProp` assignment `go.transform.rotation = Quaternion.Euler(0, yaw + 180, 0)` replaces the imported prefab's native root orientation. Both `STREET_TREE.fbx` and `REUSED_BENCH.fbx` encode a binary model rotation approximately `(90,0,180)` and use importer `bakeAxisConversion=0`. The tree geometry's long axis is raw local Z. Discarding its imported rotation explains the sideways trees noted in [river QA](city-rebuild-v002-river-qa.md).

Preserve the imported prefab's native local rotation/scale inside a separate yaw-only placement wrapper, or compose the yaw quaternion with `asset.transform.localRotation`. Keep the importer `.meta` unchanged. Then calculate loaded world bounds and ground the object again. Native geometry measurements provide useful sanity checks: the tree's raw X×Y×Z dimensions are approximately **2.6833×2.5519×4.6875m**, with uniform native scale **1.014276**, so its upright height is about **4.7544m**; the bench is approximately **1.8000×0.5675×0.9725m**, with upright height **0.9725m**. World footprint rotates with placement yaw, so compare vertical height and orientation rather than expecting an invariant axis-aligned X/Z extent. The tree-trunk and bench collision objects also need a world-upright frame after the visual orientation is restored.

These findings and the existing door-marker evidence were sent directly to the Unity specialist. The saved scene must be corrected incrementally; rerunning the original city generator or replacing the existing river implementation is unnecessary.

### Actual door access evidence to retain

The [55-placement entry CSV](city-rebuild-v002-external-entry-evidence.csv) remains valid source-geometry evidence; it explicitly does not claim door threshold, outward-normal or walkability verification. For the 39 provisional approach-direction conflicts, retain the approved building position/yaw and create scene-only exterior connectors from the graph approach to the actual door/ramp. The source marker should be transformed using the calibrated imported-model frame, then checked against the visible door/ramp geometry, the building mesh collider and a body-width sweep. A straight connector through a footprint or a ray that lands on the broad city ground is insufficient. For campus buildings, the preserved individual `ENTRY_GLASS_i` and `ENTRY_STEP_i` FBX renderers permit direct scene-space marker inspection. No architectural source modification is justified by the existing evidence.

| Resume asset inspection | Status | Limit |
|---|---|---|
| Six existing park/tree/bench FBX binaries readable and unchanged | PASS | Binary inspection only |
| Existing sports facilities reference actual Campus FBX meshes | PASS | Saved scene serialization inspected |
| Existing park modules reusable through connected-component derivatives | PASS | Original merged FBXs remain preserved |
| Cause of sideways prop orientation identified | PASS | Native rotation overwritten in old placement code |
| Recognizable upright trees and benches after scene correction | NOT TESTED by asset audit | Requires fresh Unity Apply and captures |
| Actual door/ramp exterior connections and body clearance | NOT TESTED by asset audit | Unity runtime inspection required |
| New Blender source/export required for Phase 4 | No | Existing FBX geometry is sufficient |

Catalog generation and `--check` remain coordinated by the main agent after the scene/assets settle. Asset registration and `received`/`approved` states were not changed by this continuation.
