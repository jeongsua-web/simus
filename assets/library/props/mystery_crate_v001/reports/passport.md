SCENE
- intent: reusable Korean road-control props and a separate grounded mysterious transport crate.
- deliverable: two independent Blender sources, individual FBX, Unity prefabs, previews, reports, manifest received.
- units: metres; axes: right-handed Z-up; Blender -Y front -> Unity +Z.
- render: EEVEE, 1100x850, AgX exposure0,24fps,1-96.
- dynamic: crate hinge opens 0 to85deg frame24-72; road static placement assets as requested, warning optional.
HIERARCHY
- Separate asset ROOT empties, semantic parts and collider proxies. ROAD_CONTROL_ROOT with independent groups displayed separately.
- MYSTERY_CRATE_ROOT > hinged LID and attached lid parts; body stays stationary.
- Protected: every preexisting scene/datablock/project file. No map placement. New scenes only, isolated saves.
ASSETS
- Barricade01 [BLOCK] detailed prop 2.0,.55,1.05; foot center origin. Broad rubber feet, twin uprights, shallow reflective diagonal bands.
- Barricade02 [BLOCK] detailed same footprint with alternating hinge coupling and guide empties.
- WarningLight [BLOCK] detailed .16,.12,.26 mount pivot; yellow emission separately toggleable.
- Cone01 [BLOCK] detailed .40,.40,.70,16-sided stepped taper; white bands material regions, rubberbase.
- Cone02 [BLOCK] detailed .28,.28,.45. Fallen and tilted variants use geometry-level rotation and ground contact.
- Connector [BLOCK] detailed 1.6m telescoping striped tube with rings at both ends, ground-based origin.
- MysteryCrate [BLOCK] detailed .84,.66,.66; dark wood inset slats, oxidized steel frame, hinge and handles, asymmetric latch, small fictional storage ID and abstract nonhazard symbol.
- Comparison adult/taxi/cardboard [EXISTING] read-only appended preview copies excluded exports.
- No generation/credits/external downloaded assets.
SHOT
- Active orthographic oblique camera; individual front/side/back and detail shots. Neutral floor for ground contact, no background clutter.
LOOK
- Existing-project compatible flat PBR role materials; orange/white/black/metal; crate dark brown/slate/oxidized frame and weak teal interior.
- No external textures. Wear via sparse shallow polygons; shared slots, no high-frequency noise. Roughness .35-.85; metal .65.
LIGHTING
- Studio key upper front-left; soft large area defines form. weaker fill right recovers dark crate interior without flattening.
- Neutral low world, fixedAgX, world-only/zero-world/key/fill diagnostics. No fog, no runtime lights.
MOTION
- Crate1-24closed;24-72opening;72-96rest. EaseBezier, lid pivot rear upper hinge. Samples1,24,48,72,96.
- Collision proxies parented to moving lid. Lock hasp moves with lid and meets body catch closed.
ACCEPTANCE
- Feet atground, unit scales, outward closed surfaces, no lost materials; collider mesh excluded render.
- Asset dimensions and Unityfront verified from FBX. Prefabs independently placeable; no gameplay scripts modified.
- Lid clearsbody at0/20/45/85, empty thick-walled interior, no SF/brand/hazard glyph.
- Inspect actual renders every required angle and scale comparison. LOD0 only, no approval claim.
refs_read: blender-scene,blender-scene-spec,blender-modeling,blender-lookdev,blender-lighting-camera,blender-animation,blender-audit-finalize,blender-volatile
TODO: A inspection/spec complete; B checkpoint; C silhouette/proportion/contact/camera; D detail/material; E exports/Unity/visual/registration.
