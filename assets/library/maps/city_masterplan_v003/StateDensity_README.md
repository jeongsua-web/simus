# City stat display density — 2026-11-17

Applied Unity scene: `unity/Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_EventPlaces.unity`.

114 state locations: HAP 6, SAF 14, CLN 74, POL 20. These are conditional locations, not simultaneously active counts. Cleanliness includes 60 new clusters (720 modeled litter items plus bottle necks/bag knots). Pollution includes 12 replacement emitters: 3 vehicle tailpipes and 9 commercial rooftop ducts, maximum 288 particles total. Four shared litter meshes and shared materials keep the additional mesh renderer count at 72.

Removed from state bindings: 2 balloons, 2 flags, 2 closed-shop signs, 2 normal benches. Kept original assets hidden. Old 6 unanchored smoke/smog targets remain hidden. Existing permanent flowerfield unchanged.

New trash activation: 12 below 50, another 24 below 35, another 24 at 20 or lower. Emissions: 4 above 50, another 4 above 65, another 4 above 80. Retained slots preserve previous thresholds. Aggregate CityStatePoller values are used; no invented regional mappings. No city state means hidden. Preview has no server effects. Source-disabled guard hides corresponding smoke.

Open this scene in Unity and Play. Use `City stat visual preview`, then `Poor cleanliness / polluted` to view trash and exhaust. Return to live data afterwards. Default launch scene and Build Settings were not changed. The built-in com.unity.modules.particlesystem 1.0.0 module was enabled to make exhaust work in Play Mode and runtime.

Validation: original transforms preserved; 30 event paths complete; six preview levels tested in Play Mode; default hidden state and source visibility guard tested; meshes/materials present. Rooftop and ground heights fitted to actual surface geometry. Preview images show the polluted state.

This update is Unity scene authoring. Blender was disconnected: the .blend and FBX are unchanged and do not include these new Unity-only placements. Existing geometry/event source files remain intact. Live API and WebGL performance were not tested in this update. Display links are not event gameplay logic. Status remains received, map_version unconfirmed.
