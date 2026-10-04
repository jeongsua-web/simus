SIM:US Dense University Map03

Scene: SIMUS_DENSE_REALISTIC_MAP_03
Main collection: SIMUS_DENSE_REALISTIC_CITY
Main camera: CAM_SIMUS_DENSE_MAP_03

24 houses,12 villas,18 shops,8 apartments,1department store,5parks.
43 additional shared furniture instances;33additional trees. Original equipment remains inside reused building/park instances.
Existing21484objects protected: basis transforms,data names,parent relationships unchanged. Three external source file hashes unchanged.
Newly arranged plots: no detected AABB overlaps or axis-road intrusions. All63building entries and5park entries have route metadata and geometry connections.177simple obstacle collider meshes.
FBX reimport:1385meshes,0missing,0bounding-box mismatches,0material-slot or material-area mismatches. See JSON audit files and rendered evidence.

Campus exception: source window-row pitch2.35m; uniformly scaled1.20 (per requested cap) to2.82m. This remains below preferred3.3m. Original floors,footprints,and relative placement preserved. New2.3m entry doors,frames,canopies,steps,perimeter parapets and foundation supports added on the placed copy only.

Unity: copy UnityEditor/SIMUSDenseMap03Importer.cs to Assets/Editor before importing the FBX. It disables obstacle-helper renderers and creates basic colliders. This helper is uncompiled/unexecuted in Unity; NavMesh,Occlusion Culling and runtime performance must still be checked in the target project. Meshes/materials are shared between repeated assets. No claim of baked NavMesh or automatic LODGroups.

Collection names are D03-prefixed to avoid renaming identically named collections in protected older scenes. semantic_name properties store requested category names. Backups and sources are hidden; export representation is hidden from the editable map render.

FBX material simplification retains source colors and image textures; procedural Blender shading is not reproduced exactly by FBX.

Deliverables: SIMUS_Dense_Realistic_University_Map_03.blend, SIMUS_Dense_Realistic_University_Map_03.fbx,Textures/,UnityEditor/,audits and previewPNG images.
