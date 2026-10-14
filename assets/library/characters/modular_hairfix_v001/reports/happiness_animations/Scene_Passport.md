refs_read: blender-scene, blender-scene-spec, blender-animation, blender-lighting-camera, blender-audit-finalize, blender-volatile
SCENE
- intent: add happiness Actions only, existing CapFix modular character.
- deliverable: same-folder blend/FBX; outside-project byte-identical backup; preview sheets.
- units: metres; right-handed Z-up; original character 1.65m, front -Y.
- render: existing EEVEE lights/world retained; diagnostic workbench 600x760, 30fps. Dynamic rig.
HIERARCHY
- MODULAR_CHARACTER / SIMUS_CHARACTER_ROOT / ARMATURE; preserve all 26 exported objects, 22 bones, materials, weights, geometry and hierarchy.
ASSETS
- A01 modular character | EXISTING | stylized | existing dimensions, origin and pose reference preserved.
SHOT
- Existing front/side/head cameras retained; temporary camera reposition for review only, restore afterward.
LOOK
- EXISTING materials and color structures, no modifications.
LIGHTING
- Existing studio lights, World and exposure; no new lights. Neutral background for readable poses.
MOTION
- 30fps; happy idle 90f, walk30f, cheer60f, wave60f; neutral idle90f from Idle, walk30f from Walk; sad idle120f, walk42f, sigh90f.
- Loop idles/walks; one-shot cheer/wave/sigh. Root stationary; analytical foot contact; no rig constraints added.
ACCEPTANCE
- All protected hashes unchanged, old Actions retained, independent new Actions with fake users, same-folder deliverables.
- All-frame foot/root and seam audit; in-place gait speed documented. Head attachments follow exactly. All16 hair choices and2glasses sampled across clips.
- Contact sheets actually viewed; FBX reimport names/rig/geometry/animation verified. Unity Editor recognition reported separately if unavailable.
