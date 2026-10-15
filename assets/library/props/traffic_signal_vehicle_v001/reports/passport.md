# Signal Scene Passport
2026-10-15. Two independent static props; existing map untouched.
References: user detailed specification, existing traffic_light metal materials, actual adult1.645m/taxi4.894m. No downloaded assets or logos.
Units metres; Blender front -Y, Unity front +Z; origins pole foot ground. Vehicle arm extends local +X in Blender; runtime mapping verified by actual import.
Vehicle: pole diameter.22 height5.8, arm3.8m, housing1.64x.22x.44 bottom5.06, four .30 diameter lenses red/amber/left/green left-to-right from front. Pedestrian: pole.12 height2.95, housing.32x.20x.76 bottom2.12, redstand above greenwalk.
Reuse existing Brushed metal and Blue charcoal powder coat in independent source copies; shared Unity materials. Separate off lenses and emission meshes, no point lights; no animated mechanics. Green blink implemented in dedicated instance-local component, no traffic sequencing.
Camera gate: full front/side/rear and head detail; separate day/night. Foot contact/brackets/hood silhouette first, detail next.
Audit: dimensions, normals, no openings, individual state toggles, blink samples, independent instances, native Unity import/render, prefab/default red, no original changes. LOD0 only disclosed.
Delivery: props/traffic_signal_vehicle_v001 and traffic_signal_pedestrian_v001, shared materials in traffic_signal_shared_v001, new runtime SignalDisplay component. received, map_version blank.
