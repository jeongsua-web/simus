#!/usr/bin/env python3
"""Open the saved bridge .blend and validate original source, without resaving."""
import bpy
import hashlib
import json
import pathlib
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "assets/library/props/river_footbridge_v001"
SOURCE = BUNDLE / "source/SIMUS_River_Footbridge_v001.blend"
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
expected = {
    "SOURCE_NORTH_28_70m": ("RIVER_DECK_NORTH_28_70", (3.4, 28.7, 0.4)),
    "SOURCE_SOUTH_32_10m": ("RIVER_DECK_SOUTH_32_10", (3.4, 32.1, 0.4)),
    "SOURCE_RAIL_MODULE_2m": ("RIVER_RAIL_MODULE_2M", (0.16, 2, 1.1)),
    "SOURCE_RAIL_END_POST": ("RIVER_RAIL_END_POST", (0.14, 0.14, 1.1)),
}
results = []
for scene_name, (object_name, dimensions) in expected.items():
    scene = bpy.data.scenes[scene_name]
    objects = [o for o in scene.objects if o.type == "MESH"]
    assert len(objects) == 1, (scene_name, len(objects))
    obj = objects[0]
    assert obj.name == object_name
    points = [obj.matrix_world @ Vector(p) for p in obj.bound_box]
    lo = [min(v[i] for v in points) for i in range(3)]
    hi = [max(v[i] for v in points) for i in range(3)]
    size = [hi[i] - lo[i] for i in range(3)]
    assert max(abs(size[i] - dimensions[i]) for i in range(3)) < 0.00001, (object_name, size)
    assert obj.location.length < 0.000001
    if "DECK" in object_name:
        assert abs(hi[2]) < 0.000001
    materials = sorted(s.material.name for s in obj.material_slots if s.material)
    assert materials
    results.append({"scene": scene_name, "object": object_name, "dimensions_blender_xyz_m": size,
                    "bounds_min": lo, "bounds_max": hi, "pivot_location": list(obj.location), "materials": materials})
report = {"status": "PASS", "method": "Actual Blender open_mainfile of final saved source; no resave",
          "blender_version": bpy.app.version_string,
          "source": str(SOURCE.relative_to(ROOT)), "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
          "assets": results, "preview_scene": "PREVIEW_ONLY_ASSEMBLED_BRIDGE" in bpy.data.scenes}
(BUNDLE / "reports/blender_source_load_validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"status": report["status"], "scenes_checked": len(results), "source_sha256": report["source_sha256"]}))
