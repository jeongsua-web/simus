"""Export the editable neighborhood reference for the Unity prototype.

Run with Blender in background mode. All conversions happen in memory; this
script never saves or modifies the original .blend file.
"""

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector


WORKSPACE = Path(__file__).resolve().parents[2]
SOURCE = WORKSPACE / "outputs/district_prototype/SIMUS_Neighborhood_Prototype.blend"
ART = Path(__file__).resolve().parent / "SIMUSPrototype/Assets/Art"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    original_hash = sha256(SOURCE)
    if Path(bpy.data.filepath).resolve() != SOURCE:
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE))

    root = bpy.data.objects.get("SIMUS_MAP_ROOT")
    if root is None:
        raise RuntimeError("Expected source map root SIMUS_MAP_ROOT was not found.")
    candidates = [root, *root.children_recursive]
    excluded = {obj for collection in bpy.data.collections if collection.name.startswith("Presentation")
                for obj in collection.all_objects}
    map_objects = [obj for obj in candidates if obj not in excluded
                   and obj.type not in {"CAMERA", "LIGHT"}]
    if not map_objects:
        raise RuntimeError("No map objects were selected for export.")

    cameras = []
    for obj in bpy.data.objects:
        if obj.type == "CAMERA":
            cameras.append({
                "name": obj.name,
                "blenderPosition": list(obj.matrix_world.translation),
                "blenderRotationQuaternionWXYZ": list(obj.matrix_world.to_quaternion()),
                "projection": obj.data.type,
                "orthographicScale": obj.data.ortho_scale,
            })

    materials = {}
    for obj in map_objects:
        for slot in obj.material_slots:
            material = slot.material
            if material is None or material.name in materials:
                continue
            color = list(material.diffuse_color)
            metallic, roughness = 0.0, 0.5
            if material.use_nodes and material.node_tree:
                principled = next((node for node in material.node_tree.nodes
                                   if node.type == "BSDF_PRINCIPLED"), None)
                if principled:
                    color = list(principled.inputs["Base Color"].default_value)
                    metallic = float(principled.inputs["Metallic"].default_value)
                    roughness = float(principled.inputs["Roughness"].default_value)
            materials[material.name] = {"name": material.name, "color": color,
                                        "metallic": metallic, "roughness": roughness}

    converted_names = []
    for obj in map_objects:
        if obj.type not in {"CURVE", "FONT", "SURFACE", "META"}:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.hide_set(False)
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        converted_names.append(obj.name)
        bpy.ops.object.convert(target="MESH")

    # Conversion can replace datablocks, so collect the hierarchy again.
    map_objects = [obj for obj in [root, *root.children_recursive]
                   if obj not in excluded and obj.type in {"MESH", "EMPTY"}]
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    triangle_count = 0
    for obj in map_objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        points.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangle_count += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    minimum = [min(point[axis] for point in points) for axis in range(3)]
    maximum = [max(point[axis] for point in points) for axis in range(3)]
    dimensions = [maximum[axis] - minimum[axis] for axis in range(3)]
    if not (199.0 <= dimensions[0] <= 201.0 and 199.0 <= dimensions[1] <= 201.0):
        raise RuntimeError(f"Unexpected map bounds; expected a 200 m site, got {dimensions}.")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in map_objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    ART.mkdir(parents=True, exist_ok=True)
    fbx = ART / "Neighborhood.fbx"
    bpy.ops.export_scene.fbx(
        filepath=str(fbx),
        use_selection=True,
        object_types={"MESH", "EMPTY"},
        global_scale=1.0,
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_UNITS",
        axis_forward="-Z",
        axis_up="Y",
        use_space_transform=True,
        bake_space_transform=False,
        use_mesh_modifiers=True,
        mesh_smooth_type="OFF",
        use_custom_props=True,
        add_leaf_bones=False,
        bake_anim=False,
        path_mode="AUTO",
        embed_textures=False,
    )
    write_json(ART / "BlenderMaterials.json", {"materials": sorted(materials.values(), key=lambda item: item["name"])})
    final_hash = sha256(SOURCE)
    if final_hash != original_hash:
        raise RuntimeError("The source .blend changed during export; investigate before using these assets.")
    report = {
        "source": str(SOURCE.relative_to(WORKSPACE)),
        "sourceSha256Before": original_hash,
        "sourceSha256After": final_hash,
        "sourcePreserved": original_hash == final_hash,
        "blenderVersion": bpy.app.version_string,
        "exportedRoot": root.name,
        "objectCount": len(map_objects),
        "meshCount": sum(obj.type == "MESH" for obj in map_objects),
        "emptyCount": sum(obj.type == "EMPTY" for obj in map_objects),
        "evaluatedTriangleCount": triangle_count,
        "convertedTextAndCurveCount": len(converted_names),
        "materialCount": len(materials),
        "blenderWorldBounds": {"minimum": minimum, "maximum": maximum, "dimensionsMetersXYZ": dimensions},
        "fbxAxisForward": "-Z",
        "fbxAxisUp": "Y",
        "fbxApplyScaleOptions": "FBX_SCALE_UNITS",
        "expectedUnityDimensionsMetersXYZ": [dimensions[0], dimensions[2], dimensions[1]],
        "fbxBytes": fbx.stat().st_size,
        "sourceCameras": cameras,
        "notes": [
            "Presentation collection and all lights/cameras are excluded from FBX.",
            "Material colors are Principled BSDF base-color values in linear color space.",
            "Text and curves are converted to mesh only in the export session.",
            "Map objects remain individually named for later interactions.",
            "Unity ModelImporter should use globalScale=1 and useFileScale=true; validate imported bounds.",
        ],
    }
    write_json(ART / "NeighborhoodExportReport.json", report)
    print("SIMUS_EXPORT_COMPLETE " + json.dumps({key: report[key] for key in [
        "objectCount", "meshCount", "evaluatedTriangleCount", "materialCount", "fbxBytes", "sourcePreserved",
        "expectedUnityDimensionsMetersXYZ"]}))


if __name__ == "__main__":
    main()
