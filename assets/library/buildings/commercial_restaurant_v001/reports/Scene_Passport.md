SCENE
- intent: Reuse existing Korean commercial architecture; distinct cafe and restaurant ground-floor derivatives.
- deliverable: two independent editable Blender sources, FBX exports, Unity prefabs, still inspection images; no map placement.
- units: metres; axes: right-handed Z-up
- render: Cycles, 1200x1000, static asset inspection
- dynamic: no; requested deliverables are static building assets and enumerated still inspection views.
HIERARCHY
- collection/object naming: CAFE_* / RESTAURANT_* semantic controls; PREVIEW_ONLY excluded from FBX.
- parent/child relationships: BUILDING_ROOT > functional groups > separate geometry.
- protected existing objects: all original project files and original upper-floor world geometry/material assignment.
ASSETS
- A01 CAFE | route EXISTING | fidelity detailed semi-low-poly | existing C03 12.6x16.2m shell; roof equipment 13.88m | origin 0,0,0; orientation unchanged | CAFE_BUILDING_ROOT | hero
- A02 RESTAURANT | route EXISTING | fidelity detailed semi-low-poly | existing C01 10.8x15.3m shell; roof equipment 16.49m | origin 0,0,0; orientation unchanged | RESTAURANT_BUILDING_ROOT | hero
- A03 storefronts/awnings/signs/planters/menu/furniture/equipment | route BLOCK | fidelity detailed semi-low-poly | facade plans in reports/model.json | independent functional groups | primary shop identity
- generation estimate/submission: none, no paid generation.
SHOT
- active camera: Preview Camera
- framing/lens/target: orthographic hero plus exact front, left/right, side/rear, close entrance and lighting stills.
- foreground/subject/background: grounded original apron, storefront + preserved upper shell, neutral studio.
LOOK
- material roles and palette: ivory/dark green/timber cafe; warm cream/rust restaurant; preserve upper materials.
- material route EXISTING and locally authored flat export-compatible images.
- UV: explicit 0..1 for replaceable sign/menu/window illusion; packed original tile texture retained.
- relief: geometry bevels, no displacement.
- roughness: plaster .6, metal .4-.45, glass .17.
- world: soft blue gray neutral.
LIGHTING
- focal: storefront; secondary: original upper architecture; darkest: false interior backs.
- reference mood: daylight and separate night practical test.
- environment route NONE; no HDRI dependency.
- baseline: daylight world .65 / sun 2.2; night world .1 / sun .08.
- key direction: oblique sun, angle .12 radians; fill from world.
- practicals: two attached warm wall lamps and emissive window illusion.
- reflections: restrained glazing with opaque rear plane; no far-side visibility.
- gobos/flags/atmosphere: none.
- color management: AgX, fixed exposure.
MOTION
- not applicable to static building export; lights/doors/signs remain individually toggleable in Unity.
ACCEPTANCE
- structural: original files hash identical, upper geometry unchanged, correct metre size/origin/front, groups/materials/textures resolve, nonnegative scale; new solid normals valid.
- motion: not applicable.
- visual: distinguish cafe vs restaurant, physical mounts/contact, readable signs, no full interior, clear doorway, retained upper silhouettes.
- lighting: daylight/night and isolated key/world/practical review; no missing textures or leaked studio geometry.
refs_read: blender-scene, blender-scene-spec, blender-modeling, blender-lookdev, blender-lighting-camera, blender-audit-finalize

Task gates: existing source geometry inspected; original and storefront camera renders viewed; Bridge connected and pre-change checkpoint saved; derived assets loaded for focused repairs and audit. No rebuilding approved upper geometry.
