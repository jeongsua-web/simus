# Scene Passport — SIMUS City Masterplan v003
SCENE
- intent: warm Korean university city; masterplan v003 exact coordinates; new assets only.
- deliverable: Blender editable source, Unity blockout / visual slice / complete scenes and measured evidence.
- units: metres; Blender right-handed Z-up; Unity (x,y,z) to Blender (x,-z,y).
- render: EEVEE, 1600×1200, 24fps, frames1–120.
- dynamic: review camera subtle drift with settled first/last; no original game camera changes.
HIERARCHY
- collection/object naming: CITY_MASTERPLAN_V003 with requested 23 semantic groups.
- parent/child relationships: wrapper centred on planned footprint and bottom; imported native transforms preserved inside adapter.
- protected existing objects: all original files, materials and current Blender Scene; new separate scene.
ASSETS
- A01 campus14 + streetside76 | EXISTING | stylized | exact layout.json footprint/height measured source | normalized front adapter | buildings.
- A02 terrain/roads/water/interiors | BLOCK | detailed after blockout gate | exact payload meshes | world origin | semantic collections.
- A03 reusable facilities/NPC/state assets | EXISTING | stylized | measured metre scale | independent event/state parents.
- generation estimate/submission state: no paid generation.
SHOT
- active camera: CAM_Map_Overview; ortho620m target(15,-50,0), foreground housing, middle retail, background campus.
- slice target: east campus/river70×70m; three-quarter view.
LOOK
- material roles and palette: teal campus, ivory pavement, brick/cream shops, varied green foliage, cyan opaque water.
- material route: existing copies plus shared local flat PBR; no source material modifications.
- texture scale: metre-sized variation; geometry faceting; no detailed photo textures.
- relief: small true bevel on new geometry; no displacement.
- dielectric/roughness: metallic0–.2 roughness.55–.85.
- world: cool weak sky.
LIGHTING
- focal subject campus / secondary river / darkest under eaves.
- mood: warm daytime; no HDRI generation.
- baseline: world-only and zero-world previews before final lighting approval.
- key: warm southwest sun, soft angle.08; cool ambient keeps shadow forms legible.
- fill: environment only; no shop Point Light grid.
- reflection: opaque stylized water, no realtime planar reflection.
- atmosphere: none; AgX exposure0.
MOTION
- 24fps frames1–120; camera rests1–24, slight drift24–96, rests96–120; buildings static.
ACCEPTANCE
- structural:90 building wrappers,30 event roots,56 independent state slots; source hashes unchanged.
- motion: camera evaluated at1/60/120; NPC original rigs retained.
- visual: no unresolved blocks in detailed slice/final, warm coherent materials, bevel/contact, readable water/foliage.
- lighting: inspect baseline/key/full/grayscale and clipping.
- Unity: NavMesh traversal, entrances/interiors, collision, performance, WebGL real test required before completion.
refs_read: blender-scene, blender-scene-spec, blender-modeling, blender-lookdev, blender-lighting-camera, blender-animation, blender-audit-finalize
## Gates
- [x] Reference modules read; Phase A specified.
- [x] Phase B external project backup and live Blender checkpoint.
- [ ] Phase C silhouette/proportion/depth/contact/camera-read.
- [ ] Phase D Unity movement test then visual slice before full detailing.
- [ ] Phase E structural/motion/visual/Unity/WebGL evidence.
