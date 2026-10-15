SCENE
- intent: independent fictional Korean metro entrance, informed by two user photos; no map placement.
- deliverable: Blender, FBX, texture/materials, Unity prefab with simple colliders and inactive guides, 15 inspection images, report/catalog.
- units: metres; right-handed Z-up; entering -Y in Blender / +Z Unity; origin front center z0.
- render: EEVEE 1200x900 AgX 30fps; static infrastructure explicitly permits stationary escalators; inspection cameras only.
HIERARCHY
- SUBWAY_ENTRANCE_ROOT > semantic component groups; stairs, 2 escalators, glass, signs, lights, tunnel separate.
- guides and collider proxies separate; no render participation; preview-only cameras/lights/reference models not exported.
- protected: live cat scene 62 objects, original cutecat file, all project maps/assets/code.
ASSETS
- A01 canopy | BLOCK detailed | width5.9 length10.8 height3.05 | front origin | root | primary silhouette
- A02 stair | BLOCK detailed | width2.1,20 rises .17 / runs .30,depth3.4 | t1.8..7.8 | root | pedestrian access
- A03 escalators x2 | BLOCK detailed | overallwidth1.05 each, tread .72, length7.5 | adjacentstairs | root | static separated step/handrail/plate groups
- A04 lower passage | BLOCK stylized | width5.3,length4.6,height2.6 | z-3.4 | root | dark connection, removable portal
- A05 signs | BLOCK detailed | pillar3.6m, horizontal4.6m | entrance | root | fictional SIMUS METRO, EXIT1, generic train/arrows
- A06 paving/drain/rails | BLOCK detailed | forecourt1.8m clear | front | root | believable interface
- A07 taxi/adult | EXISTING read-only copies | actualsource size | previewonly | comparison
- generation:none.
SHOT
- active front-right oblique; additional front, sides, rear, top, inside, portal, signs, glazing, tactile, scale, guides and night.
- camera must reveal underground descent; cutout preview ground is a ring, never a slab across opening.
LOOK
- 13 lightweight shared materials: coated charcoal frame, clear glass, neutral stone/concrete, brushed escalator metal, rubber, yellow tactile, sign atlas, emitter, dark passage, drain.
- native authored sign PNG; UV mapped; Blender packed and Unity external PNG. No photo/logo copies.
- glass alpha about.15, thin panels, mild blue-gray, minimal reflection; actual Unity Built-in Standard.
LIGHTING
- neutral daylight studio key from upperfront-left, sky fill; tunnel light anchors plus a few preview lights.
- focal sign/entrance; darkest region tunnel portal; no atmosphere. AgX exposure0.
- day key-only and night frames verify structure and emission; actual runtime lights optional disabled.
MOTION
- no mechanical motion required; escalator steps and each handrail remain editable for future implementation.
- static asset, no animation export.
ACCEPTANCE
- structural: 20 uniform steps, 2 escalators, visible descent, closed portal, glasspanel support, identity scales, independentcontrols, safe colliders.
- visual: long low flat canopy, realistic adult/car scale, readable fictional signs, no opaque black glass, no floatingparts.
- Unity: dimensions/axes/materials/texture, collider slope and free approaches, inactive guide/no colliders, prefab roundtrip renders.
- placement: cutout x±2.65 and t1.8..12.3; frame±3,t-1.8..12.7; clearance1.8m infront. Document terrain mustbe cut, not modify map.
refs_read: blender-scene, blender-scene-spec, blender-modeling, blender-lookdev, blender-lighting-camera, blender-animation, blender-audit-finalize, blender-volatile (read in this session).
TODO
- [x] PhaseA references/rules/currentstate
- [x] PhaseB externalcheckpoint
- [x] PhaseC silhouette/proportion/depth/contact/camera
- [x] PhaseD details/lookdev/colliders
- [x] PhaseE Blender+Unity audit/package/register
