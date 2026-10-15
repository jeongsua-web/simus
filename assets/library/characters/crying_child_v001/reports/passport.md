# Crying child — production plan
SCENE
- intent: distinct fictional Korean elementary-age child, SIMUS semi-low-poly.
- deliverable: editable child, four in-place actions, FBX, separate Unity prefab and evidence.
- units: metres; right-handed Z-up; front -Y (Unity +Z).
- render: EEVEE, 800 square, 30 fps, 1–151; dynamic yes.
HIERARCHY
- CHILD_CRYING_ROOT > ARMATURE and named CHILD meshes, accessory anchors.
- protected: default scene and all source assets; reference copies only.
ASSETS
- adult reference [EXISTING] original 1.645m, inspection/comparison only.
- child skin/clothes/rig [EXISTING] copied then independently proportioned, target 1.25m, origin between soles, stylized finished fidelity.
- hair, sad face, tears, backpack [BLOCK] detailed stylized editable meshes, head/torso anchored.
- no generated assets or credits.
SHOT
- CAM_Child_Front orthographic 1.55m, target z0.64; sides/back/oblique/close-ups.
- neutral studio, floor contact visible, child primary focus.
LOOK
- copied warm skin/dark hair, pastel yellow sweatshirt, navy pants, pale shoes, muted orange bag, pale blue tears.
- material route EXISTING copies and local flat Principled colors; no external textures/displacement.
- matte cloth roughness .75, skin .65, tears .35; neutral world.
LIGHTING
- face primary, bag secondary; back shadows allowed but readable.
- neutral studio, no generated environment/HDR; world/zero/key diagnostic images.
- broad upper left key, weak right fill to retain cheek form, no atmosphere.
- AgX exposure0; no reflective hero surfaces.
MOTION
- 30fps: sad idle4s loop, cry5s loop, wipe2.5s one-shot, strong sob3s loop.
- static root, planted feet; head/spine/arms carry acting; hand targets outside face.
- rest A pose separate from actions. Loop seams equal poses.
ACCEPTANCE
- named hierarchy, weight/armature preserved independently, height1.15–1.35, no missing textures.
- four exported clips, valid Humanoid, upright and in-place; sample and inspect hand/face and feet.
- child proportions distinct from adult, no block decorations; visible sadness and cheek tears.
- preview renders all required angles/poses, light baselines and readable shadows.
refs_read: blender-scene, blender-scene-spec, blender-modeling, blender-lookdev, blender-lighting-camera, blender-animation, blender-audit-finalize, blender-volatile.
Checklist: modules read [x]; A specification [x]; B checkpoint [x]; C proportions/camera [ ]; D refine/rig/actions [ ]; E audits/exports/delivery [ ].
