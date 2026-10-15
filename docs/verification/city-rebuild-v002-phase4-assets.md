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
