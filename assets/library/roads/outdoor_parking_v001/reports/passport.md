# Parking Scene Passport
SCENE
- intent: Korean paid outdoor car park, modular reusable semilowpoly asset; no map placement
- deliverable: isolated blend, complete/module FBX,10 Unity prefabs, PBR materials/asphalt texture, previews/reports/received manifest
- units: metres; axes: right-handed Z-up; ingress -Y -> Unity +Z
- render: EEVEE1200x900,24fps1..120
- dynamic: entry/exit gate85degree open demo; rest at1 and96
HIERARCHY
- collection/object naming: PARKING_ASSETS/PARKING_PREVIEW; PARKING_LOT_ROOT and named requested modules
- parent/child relationships: pivot arms under independent gate roots; collider boxes follow physical modules; guides empties only
- protected existing objects: entire FESTIVAL_BOOTH_SCENE and all project source files
ASSETS
- A01 lot [BLOCK] detailed |30x24x.2m |(0,-12,0)|origin front centre(0,0,0)|ROOT|asphalt20tiles6x6, .25% drainage slope
- A02 spaces [BLOCK] detailed |standard2.5x5,accessible3.5x5+1.2aisle,EV2.5x5|north8standard y-19.5; south4standard+accessible+EV y-8.5|independent modules|14spaces
- A03 access [BLOCK] detailed |6m central aisle y-17..-11; entry/exit3.25m x7..10.25/11.25..14.5; island1m|right edge|no inaccessible blind aisle
- A04 walks [BLOCK] detailed |1.6m west,front/rear; access ramp .12m rise/1.4m run|bay side aisle connectsfrontwalk|ROOT
- A05 gates [BLOCK] detailed |housing.36x.40x.95; arm2.9m long .065 thick|islandx10.5/11.0 y-3.7/-1.8|realshaft .92m high|pivot parent
- A06 machines [BLOCK] detailed |ticket .40x.38x1.22;payment .48x.40x1.40|island face driver |singlechamfered shell and shallowdisplay/controlfaces
- A07 signs/wheelstops/drains/bollards/EV [BLOCK] detailed |per measuredstandardgrid|functional positions|modules
- A08 streetlamps [EXISTING] detailed |6m candidate|4protectedpositions|copied source standalone, no originalmutations
- A09 existingcar/taxi/bus/police/NPC [EXISTING] preview-only |measure actualgeometry|comparison and swept-path sample|PREVIEW only
- oldparkingcandidate: verifiedloaded21objects,30x24perimeter, simple8+8slots,no gates/payment/accessiblespace; reference only,new functional arrangement required
- generation: none; construction_mode:blockout
SHOT
- active camera: Parking_Camera
- framing/lens/target: ortho39m,view(31,29,30) target(0,-11,0); topandcloseups
- depth: gatesforeground,markedaislemiddle,farrowbackground
LOOK
- neutral asphalt/whitepaint/concrete,charcoalmetal;blueaccess,tealEV,redwhitearm
- material route: local deterministic asphalt image/noise+tirewear, shared flatPBR remainder; reusedlamp copies
- UV: asphalt worldsize30x24m atlas; no displacement; rough.85 asphalt/.65concrete/.38metal
LIGHTING
- focal subject: gates/parkingorganization; darkest under equipment; daytime outdoor
- environment: neutralworld .5; noHDRI/fog
- structural key: broad lateral Sun; fill sky; night actualfixture helpers previewonly
- audit worldonly/zero-world/keyonly/grayscale; AgXexposure0
MOTION
- fps24;frame1..120;gate hold1..24,open24..72,rest72..120
- local Yrotation opens both mirrored arms outward/up; exacthinge fixed sample1,24,48,72,96,120
ACCEPTANCE
- structural:14spaces(12standard,1accessible,1EV),6m aisle,1.6walk,3.25entry/exit,sourceunchanged,UV/materials,positiveunit scale,closedsolidgeometry
- motion:85degree hinge fixed,no bodycollision; Unity actual pivot test
- visual: viewedtop/entrance/exit/side/close/night/car/NPC/sweptpath;no detached equipment
- lighting: individualrolesandgrayscale; no pinkmissingtexture
refs_read: blender-scene,blender-scene-spec,blender-modeling,blender-lookdev,blender-lighting-camera,blender-animation,blender-audit-finalize,blender-volatile
TODO
- [x] matching modules read
- [x] A inspection/specification
- [x] B Before_Parking checkpoint
- [ ] C silhouette/proportion/depth/contact/camera gate
- [ ] D geometry/lookdev/motion/export
- [ ] E structural/motion/visual/Unity/delivery
