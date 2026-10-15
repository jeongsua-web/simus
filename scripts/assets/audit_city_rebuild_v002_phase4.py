#!/usr/bin/env python3
"""Read existing binary FBX metadata without Blender, save, export, or import claims."""
import hashlib
import json
import math
import pathlib
import struct
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
ASSETS = [
    "unity/Assets/SIMUS/Art/vegetation/parks/COZY_NEIGHBORHOOD_PARK.fbx",
    "unity/Assets/SIMUS/Art/vegetation/parks/MODERN_MINIMAL_PARK.fbx",
    "unity/Assets/SIMUS/Art/props/city_state_v001/models/POL_TREE_HEALTHY_01.fbx",
    "unity/Assets/SIMUS/Art/props/city_state_v001/models/SAF_BENCH_NORMAL_01.fbx",
    "unity/Assets/SIMUS/Art/props/props/STREET_TREE.fbx",
    "unity/Assets/SIMUS/Art/props/props/REUSED_BENCH.fbx",
]


def read_fbx(path):
    data = path.read_bytes()
    if not data.startswith(b"Kaydara FBX Binary  \x00\x1a\x00"):
        raise ValueError(f"Not a binary FBX: {path}")
    version = struct.unpack_from("<I", data, 23)[0]
    wide = version >= 7500
    header, null_size = ("<QQQB", 25) if wide else ("<IIIB", 13)

    def prop(offset):
        kind = chr(data[offset]); offset += 1
        if kind in "YCIFDL":
            fmt = {"Y": "h", "C": "?", "I": "i", "F": "f", "D": "d", "L": "q"}[kind]
            value = struct.unpack_from("<" + fmt, data, offset)[0]
            return value, offset + struct.calcsize(fmt)
        if kind in "SR":
            size = struct.unpack_from("<I", data, offset)[0]; offset += 4
            value = data[offset:offset + size]
            return (value.decode("utf-8", "replace") if kind == "S" else None), offset + size
        if kind in "fdlibc":
            count, encoding, size = struct.unpack_from("<III", data, offset); offset += 12
            raw = data[offset:offset + size]
            if encoding == 1: raw = zlib.decompress(raw)
            elif encoding != 0: raise ValueError("Unknown FBX array encoding")
            fmt = {"f": "f", "d": "d", "l": "q", "i": "i", "b": "?", "c": "b"}[kind]
            return struct.unpack("<" + str(count) + fmt, raw), offset + size
        raise ValueError("Unknown FBX property type " + kind)

    def node(offset):
        end, count, size, name_size = struct.unpack_from(header, data, offset)
        if not end: return None, offset + null_size
        offset += null_size
        name = data[offset:offset + name_size].decode("utf-8", "replace"); offset += name_size
        props = []
        for _ in range(count):
            value, offset = prop(offset); props.append(value)
        children = []
        while offset < end - null_size:
            child, offset = node(offset)
            if child is None: break
            children.append(child)
        return {"name": name, "props": props, "children": children}, end

    nodes, offset = [], 27
    while offset < len(data) - null_size:
        value, offset = node(offset)
        if value is None: break
        nodes.append(value)
    objects = next(n for n in nodes if n["name"] == "Objects")["children"]
    models = []
    for n in objects:
        if n["name"] != "Model": continue
        p = next((c for c in n["children"] if c["name"] == "Properties70"), {"children": []})
        transforms = {c["props"][0]: c["props"][4:] for c in p["children"] if c["name"] == "P" and c["props"][0] in ["Lcl Translation", "Lcl Rotation", "Lcl Scaling"]}
        models.append({"name": n["props"][1].split("\x00")[0], "kind": n["props"][2], "transforms_fbx": transforms})
    globals_node = next(n for n in nodes if n["name"] == "GlobalSettings")
    settings = {p["props"][0]: p["props"][4:] for group in globals_node["children"] if group["name"] == "Properties70" for p in group["children"] if p["name"] == "P"}
    geometries = []
    for n in objects:
        if n["name"] != "Geometry" or n["props"][-1] != "Mesh": continue
        vertices = next(c["props"][0] for c in n["children"] if c["name"] == "Vertices")
        bounds = {"min": [min(vertices[i::3]) for i in range(3)], "max": [max(vertices[i::3]) for i in range(3)]}
        geometries.append({"name": n["props"][1].split("\x00")[0], "vertex_count": len(vertices) // 3, "local_bounds_fbx": bounds})
    return {"path": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(data).hexdigest(), "fbx_version": version, "settings": settings, "model_count": len(models), "mesh_model_count": sum(m["kind"] == "Mesh" for m in models), "models": models, "geometries": geometries}


def main():
    measurements = json.loads((ROOT / "docs/planning/city_rebuild_v002/asset_measurements.json").read_text())
    baselines = {a["existing_fbx"]: a["existing_fbx_sha256"] for a in measurements["assets"]}
    assets = [read_fbx(ROOT / p) for p in ASSETS]
    for a in assets:
        if a["path"] in baselines:
            a["matches_approved_measurement_hash"] = a["sha256"] == baselines[a["path"]]
    layout = json.loads((ROOT / "docs/planning/city_rebuild_v002/layout.json").read_text())
    ex = layout["extent"]
    ground = [ex["xmax"] - ex["xmin"] + 16, ex["zmax"] - ex["zmin"] + 16]
    result = {"method": "Python standard library binary FBX metadata read only; not Blender or Unity import execution", "assets": assets, "city_ground": {"dimensions_m": ground, "quad_triangle_max_edge_m": math.hypot(*ground), "warning_mesh_name": "CityGround", "warning_source": "Unity Editor.log line 1435 observed at audit start", "remedy": "Tessellate only generated Unity CityGround into smaller grid cells; preserve footprint and height."}}
    out = ROOT / "docs/verification/city-rebuild-v002-phase4-fbx-metadata.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"output": str(out.relative_to(ROOT)), "assets": [{"path": a["path"], "mesh_count": a["mesh_model_count"], "hash_match": a.get("matches_approved_measurement_hash")} for a in assets], "ground_diagonal": math.hypot(*ground)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
