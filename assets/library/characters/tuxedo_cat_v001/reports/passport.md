# SIMUS Tuxedo cat — 2026-10-19
refs_read: blender-scene, blender-scene-spec, blender-modeling, blender-lookdev, blender-lighting-camera, blender-animation, blender-audit-finalize, blender-volatile, blender-generation.

SCENE
- intent: realistic adult tuxedo quadruped, reference pattern and seated posture; no photo pixels or watermark.
- deliverable: isolated editable rigged Blender, FBX, textures, separate Unity prefab/controller, five actions and inspection images. No map edits.
- units: metres; axes: right-handed Z-up, facing -Y; Unity +Z up +Y.
- render: EEVEE, 1000x1000, 30fps, action-specific range.
- dynamic: yes, five requested actions.

HIERARCHY
- collection/object naming: CAT_ASSET / CAT_ROOT / CAT_ARMATURE / CAT_BODY, CAT_HEAD, CAT_EARS, CAT_EYES, CAT_NOSE, CAT_WHISKERS, CAT_TAIL, CAT_FUR_SILHOUETTE; CAT_STAGE separate nonexport.
- parent/child: skinned meshes under root, rig modifiers; anchors under root/head.
- protected existing objects: default Scene/Cube/Light/Camera and all existing project files.

ASSETS
- A01 CAT_BODY | [BLOCK] native anatomy refined beyond blockout | detailed | .19,.46,.30 | 0,0,0 | 0,0,0 | origin floor paws centre | CAT_ROOT | main skinned anatomy.
- A02 CAT_HEAD and face | [BLOCK] native mesh | detailed | .14,.14,.13 | 0,-.27,.305 | 0,0,0 | same root origin | CAT_ROOT | realistic adult feline face.
- A03 CAT_EARS | [BLOCK] native shaped shells | detailed | .15,.055,.08 | 0,-.25,.36 | 0,0,0 | root | CAT_ROOT | triangular ears.
- A04 CAT_TAIL | [BLOCK] curved tapered rings | detailed | .05,.34,.12 | 0,.25,.23 | 0,0,0 | root | CAT_ROOT | eight deform bones, curved tip.
- A05 preview adult NPC/car/bench | [EXISTING] temporary copies only | native fidelity | measure before linking | preview-only side stage | nonexport.
- generation: unavailable nonspending estimator; no paid submission. Native mesh construction with anatomy, topology and camera gates retained.

SHOT
- active camera: CAM_Cat_ThreeQuarter; 60mm equivalent orthographic portrait audit, full silhouette margin.
- front, left, right, rear, above; face/tail/paw details; adult comparison.
- depth: grey studio floor, cat, neutral background; no photo environment.

LOOK
- material roles: charcoal fur and off-white bib/blaze/socks atlas, yellowgreen eyes, pink nose/ear/pads; ivory whiskers.
- route NONE: locally authored colour and subtle short-fur normals, UV1024.
- fur direction and irregular asymmetrical mask; no dense strands or particles.
- dielectric fur roughness .72, eyes .13, nose .4. No displacement.
- world: neutral .25 strength.

LIGHTING
- focus: eyes and muzzle; secondary bib and back contour; darkest far flank still readable.
- mood: diffuse daylight studio.
- environment route NONE, no HDR required.
- baselines: world-only and zero-world images; key-only before secondary lights.
- key: broad soft upper front-left; fill weaker right, rim behind for black fur outline.
- reflection: large softbox eye highlights; no added glowing dots.
- no atmosphere or gobos; neutral AgX exposure0 locked.

MOTION
- 30fps. StandIdle150frames, Walk36frames, SitDown60frames, SitIdle150frames, StandUp60frames.
- pelvis/spine/leg kinematics, planted paws and smoothly tapered joint weights; head/ears/blink, eight tail bones.
- rests: quadrupedal standing and grounded haunches with upright chest. In-place walk paired with documented forward speed, periodic foot trajectory.

ACCEPTANCE
- structural: named rig, finite normalized weights, metres, assets separate from preview, no missing textures, no existing asset modifications.
- motion: all five actions survive save/reopen and Unity import; loop seam, ground clearance, seating leg/tail intersections visually and numerically tested.
- visual: adult proportions, continuous silhouette, irregular fur boundaries, small inset feline eyes, no photo content.
- lighting: key-only, grayscale and contrast checks; no clipped white bib/black silhouette loss.

TODO
- [x] Read mandatory modules
- [x] Phase A inspect/specify
- [ ] Phase B recovery copy and isolated scene
- [ ] Phase C anatomy blockout + camera read
- [ ] Phase D refined mesh, UV, rig, five animations
- [ ] Phase E Blender/Unity visual and structural audit, delivery/catalog
