SCENE
- intent: Korean student festival modular canopies, distinct food/game/info working fronts, reuse existing decorations.
- deliverable: one Blender, Base/Food/Game/Info FBX4 and prefabs4, shared materials/textures, audit previews/report, received registry.
- units: metres; Z-up; Blender -Y counter front -> Unity +Z. EEVEE1100x900 AgX exposure0.
- static reusable assets requested. Game wheel editable; demonstration rotation in Blender only,24fps1-96.
HIERARCHY
- FESTIVAL_BOOTH_ROOT + FOOD/GAME/INFO roots; separate frame/canopy/panels/counter/table/sign/decor/props/weights/mat/cable; per-part colliders follow toggle.
- protected: all original scenes/files/materials. Only appended copies and new FESTIVAL_BOOTH_SCENE changed.
ASSETS
- [BLOCK] frame3x2.8m,roof3.14x3.04x2.92m, eave2.35. Four grounded weighted posts and roof rafters.
- [BLOCK] cloth canopy/panels lightly curved, rear1.0m entrance at x.35..1.35. rear table1.5x.55m x-.5. counter2.35x.60x.92m front; game halfcounter with1.1m open access.
- [EXISTING] HAP_FLAGS_01 and HAP_DECOR_LIGHTS_01 from city_state_v001: copied meshes remove separate support-pole islands, retain cord/flags/bulbs, scale uniformly and attach new shortties. Original unchanged.
- [EXISTING] HAP_BANNER_ACTIVE_01: sameaspect uniform .50scale 2.4x.6; back display on fixed panel if room, otherwise counter front. Original texture reused exactly, no invented logo.
- [BLOCK] food cups/tray/menu/napkins/sauces/stock/gloves/bin; game raffle/wheel/rings/prize/display/stamp/marker; info map/brochures/radio/cardrack/desk light/lostproperty/foldingchairs.
- [EXISTING] adultCapFix preview only. Existingrestaurant furniture and streetbin inspected; no suitable foldingtable/chair there, build new, covered compactbinnew.
SHOT
- Main oblique, front/back/side/top, closeups connectors, night,anchor,NPC. Clear contact and1.5m visitor space in front (-Y).
LOOK
- shared warmwhite fabric, grey metal, wood, darkrubber, paper, accentorange/teal/blue. mattecloth rough.8. Lightemitterwarm2, sign.15.
- materialroute EXISTING for banner/flags/bulbs (copies); newnativePBR forstructure. Signs2048x512 sharedatlasorindividual512x128, replaceableUV separatefaces.
LIGHTING
- Studio leftkey broadarea, modestrightfill, neutralworld. Matchedcamera, fixedAgX; key/fill/world/no-world diagnostics andgreycheck. Night relies emission +onepreviewhelper, runtimezeroLights anchorsprovided.
MOTION
- Static prefab assets. GAME wheel separateorigin; demonstration0→180deg24-72 rest72-96, Blenderonly, sampled1/24/48/72/96.
ACCEPTANCE
- variants distinguish byfrontlayout and props, notjustsign. Realposter/flag/lightreuse logged names/sourcehash. Nooriginaledits/mapplacement.
- panels individuallytoggle; no interiorblocking fullbox. NPC anchors clearance0.8minimum; counter.92, rear1m; visitor1.5mreserved.
- unitpositive transforms, bevels, closed structuralmesh andthincloth, noheavyclothsim. Renderinspection plus actualUnityimportstate+colliderchecks.
refs_read: blender-scene,blender-scene-spec,blender-modeling,blender-lookdev,blender-lighting-camera,blender-animation,blender-audit-finalize,blender-volatile (already read this session)
TODO: Ainspect/passportdone; Bcheckpointdone; Cblockout; Dreuse/props/materials; EUnity/visual/register.
