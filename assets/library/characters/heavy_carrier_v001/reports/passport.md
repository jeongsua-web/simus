SCENE
- intent: SIMUS adult civilian supporting a heavy moving box with both hands.
- deliverable: editable independent Blender, NPC and box FBX, Unity prefabs, four clips, previews, report.
- units: metres; axes: right-handed Z-up; front -Y
- render: EEVEE, 800x800, 30fps, 1–121; dynamic yes.
HIERARCHY
- HEAVY_CARRIER_ROOT > ARMATURE and named skinned garment/body parts.
- LeftHand bone > CARRY_ANCHOR > CARRY_PROP_ROOT > box/tape/label; hand targets.
- protected: all existing project assets, map and game code, live Scene Cube/Light/Camera.
ASSETS
- A01 adult | EXISTING copied CapFix | detailed stylized | height 1.65m | origin feet | root | citizen
- A02 hair/face/glove fingers | BLOCK | detailed stylized | head/hand fit | bone weights | adult identity
- A03 box | BLOCK | detailed stylized | .70,.48,.52m | .0,-.39,1.14 | center | carry | replaceable prop
- generation: none; no credits.
SHOT
- active CAM_Heavy_Oblique; ortho2.1m target z.85; front/side/back/contact alternatives.
- subject isolated against neutral studio; no map.
LOOK
- copied skin; subdued teal top, navy pants, charcoal shoes, brown hair/gloves.
- cardboard tan roughness .85, tape warm beige .5; flat portable Principled materials, no external textures.
LIGHTING
- focus face and box contact; darkest trouser folds; neutral inspection studio.
- environment NONE; broad upper front-left key and restrained fill; no atmosphere/gobos.
- AgX exposure0; validate key-only and combined render.
MOTION
- idle120f loop, walk42f loop, struggle90f one-shot, look75f one-shot, 30fps.
- fixed root, legs ground contacts, left hand anchor drives separate box; matched analytic arm pose baked every frame.
- rest A-pose, poses only in actions; no optional put-down this version.
ACCEPTANCE
- structural: independent meshes/materials, closed box, source assets unchanged, required anchors, valid Human Avatar.
- motion: four actual distinct clips, stationary root, hand contact, loops, no frame lag.
- visual: believable weight, no meaningless clothing blocks, face visible, glove grip, no major intersections.
- lighting: neutral forms readable, no clipped face/tape, key-only check.
refs_read: blender-scene, blender-scene-spec, blender-modeling, blender-lookdev, blender-lighting-camera, blender-animation, blender-audit-finalize, blender-volatile
TODO
- [x] Phase A inspect/specify and all module reads
- [x] Phase B external checkpoint
- [x] Phase C silhouette/proportion/depth/contact/camera gates
- [x] Phase D details/materials/animation
- [x] Phase E Blender+Unity audits, delivery and registration

GATE EVIDENCE
- Bounds/silhouette/proportion: 1.644m adult, box .70x.48x.52m, front and right renders viewed.
- Contact refined after actual vertex tests: <=1.7mm gap, no >2mm interior vertices over 331 frames.
- Camera/detail/materials: front/side/back/face/box/overview renders viewed; source adult comparison viewed.
- Lighting: key-only and combined preview reviewed, no atmosphere; neutral AgX.
- Unity: Humanoid and four clips, 52 sampled poses, actual rendered evidence; hand socket fixed axis mismatch, shared materials and prop prefab verified.
- Scope: original scene externally checkpointed, independent asset only, no map placement.
