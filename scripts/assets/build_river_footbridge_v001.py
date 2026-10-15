#!/usr/bin/env python3
"""Run in Blender: build one original low-poly bridge kit and inspect FBX round trips.

Blender source Z is height and Y is bridge length; FBX uses -Z forward / Y up.
All meshes have applied transforms and centered deck pivots at deck-top height 0.
"""
import bpy
import csv
import hashlib
import json
import math
import pathlib
import shutil
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "assets/library/props/river_footbridge_v001"
UNITY = ROOT / "unity/Assets/SIMUS/Art/props/river_footbridge_v001/models"
SOURCE = BUNDLE / "source/SIMUS_River_Footbridge_v001.blend"
for folder in [SOURCE.parent, BUNDLE / "exports", BUNDLE / "previews", BUNDLE / "reports", UNITY]:
    folder.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = "METRIC"
bpy.context.scene.unit_settings.scale_length = 1.0


def material(name, rgb, roughness=0.72, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return m


MATS = [
    material("RFB_Wood_Honey", (0.40, 0.235, 0.108)),
    material("RFB_Wood_Light", (0.49, 0.307, 0.151)),
    material("RFB_Wood_Weathered", (0.345, 0.206, 0.106)),
    material("RFB_Edge_Timber", (0.235, 0.137, 0.073)),
    material("RFB_Steel_Forest", (0.052, 0.104, 0.091), 0.54, 0.3),
    material("RFB_Bolt_Iron", (0.075, 0.080, 0.076), 0.48, 0.6),
]


def activate(scene):
    bpy.context.window.scene = scene
    bpy.ops.object.select_all(action="DESELECT")


def box(name, location, dimensions, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(MATS[mat])
    if bevel:
        mod = obj.modifiers.new("Small_lowpoly_edge", "BEVEL")
        mod.width, mod.segments = bevel, 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def combine(parts, name):
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    obj.data.update()
    obj["asset_key"] = "river_footbridge_v001"
    return obj


def deck(scene, length, tag):
    activate(scene)
    parts = [box("Structural_underdeck", (0, 0, -0.125), (3.4, length, 0.13), 3)]
    count = math.ceil(length / 0.38)
    pitch = length / count
    for i in range(count):
        y = -length / 2 + (i + 0.5) * pitch
        parts.append(box(f"Transverse_timber_{i:03d}", (0, y, -0.035),
                         (3.4, pitch - 0.009, 0.07), i % 3, 0.006))
    # Timber fascia and two steel stringers make thickness legible in side views.
    for x in [-1.62, 1.62]:
        parts.append(box("Side_timber_fascia", (x, 0, -0.145), (0.16, length, 0.22), 3, 0.008))
    for x in [-1.28, 1.28]:
        parts.append(box("Longitudinal_steel_girder", (x, 0, -0.29), (0.16, length, 0.22), 4, 0.006))
    cross_count = math.ceil(length / 2.3)
    for i in range(cross_count + 1):
        y = -length / 2 + 0.18 + (length - 0.36) * i / cross_count
        parts.append(box("Visible_crossbeam", (0, y, -0.255), (3.36, 0.13, 0.14), 4, 0.004))
    obj = combine(parts, f"RIVER_DECK_{tag}")
    obj["length_m"] = length
    obj["deck_top_m"] = 0.0
    obj["overall_width_m"] = 3.4
    obj["clear_walk_width_m"] = 3.0
    obj["source_height_axis"] = "Z"
    return obj


def rail(scene):
    activate(scene)
    parts = [
        # One start post per module avoids coincident end posts when repeated.
        box("Start_post", (0, -0.93, 0.55), (0.14, 0.14, 1.1), 4, 0.006),
        box("Warm_wood_handrail", (0, 0, 1.055), (0.16, 2, 0.09), 1, 0.008),
        box("Lower_steel_rail", (0, 0, 0.19), (0.07, 2, 0.07), 4, 0.003),
        box("Upper_steel_rail", (0, 0, 0.94), (0.07, 2, 0.06), 4, 0.003),
    ]
    for i in range(1, 11):
        y = -0.93 + i * (2 / 11)
        parts.append(box("Vertical_baluster", (0, y, 0.57), (0.035, 0.035, 0.71), 4, 0.0015))
    obj = combine(parts, "RIVER_RAIL_MODULE_2M")
    obj["repeat_pitch_m"] = 2.0
    obj["start_post_blender_y_m"] = -0.93
    obj["height_m"] = 1.1
    obj["clear_walk_rule"] = "Place rail center at X=+-1.60; handrail inner face X=+-1.52"
    return obj


scenes = {}
scenes["north"] = bpy.context.scene
scenes["north"].name = "SOURCE_NORTH_28_70m"
north = deck(scenes["north"], 28.70, "NORTH_28_70")
scenes["south"] = bpy.data.scenes.new("SOURCE_SOUTH_32_10m")
south = deck(scenes["south"], 32.10, "SOUTH_32_10")
scenes["rail"] = bpy.data.scenes.new("SOURCE_RAIL_MODULE_2m")
rail_obj = rail(scenes["rail"])
scenes["post"] = bpy.data.scenes.new("SOURCE_RAIL_END_POST")
activate(scenes["post"])
post = combine([box("Terminal_post", (0, 0, 0.55), (0.14, 0.14, 1.1), 4, 0.006)], "RIVER_RAIL_END_POST")

assets = [
    ("RIVER_FOOTBRIDGE_NORTH_28_70", scenes["north"], north),
    ("RIVER_FOOTBRIDGE_SOUTH_32_10", scenes["south"], south),
    ("RIVER_RAIL_MODULE_2M", scenes["rail"], rail_obj),
    ("RIVER_RAIL_END_POST", scenes["post"], post),
]


def bounds(objects):
    points = [o.matrix_world @ Vector(corner) for o in objects for corner in o.bound_box]
    lo = [min(v[i] for v in points) for i in range(3)]
    hi = [max(v[i] for v in points) for i in range(3)]
    return {"min": lo, "max": hi, "size": [hi[i] - lo[i] for i in range(3)]}


report = {"method": "Blender source creation and actual binary FBX export/reimport; Unity import is separate", "blender_version": bpy.app.version_string, "asset_key": "river_footbridge_v001", "assets": []}
for stem, scene, obj in assets:
    activate(scene)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    target = BUNDLE / "exports" / f"{stem}.fbx"
    bpy.ops.export_scene.fbx(filepath=str(target), use_selection=True, object_types={"MESH"},
                             axis_forward="-Z", axis_up="Y", global_scale=1,
                             apply_unit_scale=True, apply_scale_options="FBX_SCALE_UNITS",
                             use_space_transform=True, bake_space_transform=False,
                             use_mesh_modifiers=True, mesh_smooth_type="FACE", add_leaf_bones=False,
                             bake_anim=False, path_mode="RELATIVE", embed_textures=False)
    shutil.copyfile(target, UNITY / target.name)
    obj.data.calc_loop_triangles()
    before = bounds([obj])
    materials = sorted({s.material.name for s in obj.material_slots if s.material})
    test = bpy.data.scenes.new(f"TEMP_IMPORT_{stem}")
    activate(test)
    bpy.ops.import_scene.fbx(filepath=str(target), use_anim=False)
    loaded = [o for o in test.objects if o.type == "MESH"]
    after = bounds(loaded)
    loaded_materials = sorted({s.material.name.split(".00")[0] for o in loaded for s in o.material_slots if s.material})
    delta = max(abs(before[k][i] - after[k][i]) for k in ["min", "max", "size"] for i in range(3))
    if delta > 0.0001:
        raise RuntimeError(f"FBX bounds mismatch {stem}: {delta}")
    if materials != loaded_materials:
        raise RuntimeError(f"Material mismatch {stem}: {materials} vs {loaded_materials}")
    report["assets"].append({"name": stem, "export": str(target.relative_to(ROOT)), "unity_copy": str((UNITY / target.name).relative_to(ROOT)),
                            "source_bounds_blender_xyz_m": before, "roundtrip_bounds_blender_xyz_m": after,
                            "maximum_bounds_delta_m": delta, "vertices": len(obj.data.vertices),
                            "triangles": len(obj.data.loop_triangles), "materials": materials,
                            "roundtrip_materials": loaded_materials, "mesh_objects": len(loaded),
                            "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})
    activate(scene)
    for imported in list(test.objects):
        bpy.data.objects.remove(imported, do_unlink=True)
    bpy.data.scenes.remove(test)

# Showcase contains linked instances only. All preview ground/cameras are excluded
# from FBX selection. This scene is saved in the editable source as visual evidence.
showcase = bpy.data.scenes.new("PREVIEW_ONLY_ASSEMBLED_BRIDGE")
activate(showcase)
preview_deck = south.copy()
showcase.collection.objects.link(preview_deck)
preview_deck.name = "PREVIEW_assembled_south_deck"
for side in [-1, 1]:
    # Leave a 3m clear side entrance around Y=0, demonstrating gap composition.
    for y in [-14.0, -12.0, -10.0, -8.0, -6.0, -4.0, 4.0, 6.0, 8.0, 10.0, 12.0, 14.0]:
        instance = rail_obj.copy()
        showcase.collection.objects.link(instance)
        instance.name = f"PREVIEW_rail_{side}_{y}"
        instance.location = (side * 1.60, y, 0)
    for y in [-2.93, 15.07]:
        instance = post.copy()
        showcase.collection.objects.link(instance)
        instance.location = (side * 1.60, y, 0)

stage_material = material("PREVIEW_ONLY_Ground", (0.39, 0.43, 0.38))
for y in [-13.5, 13.5]:
    support = box("PREVIEW_ONLY_End_land_support", (0, y, -0.85), (5.7, 5, 0.9), 3, 0.05)
    support.data.materials.clear()
    support.data.materials.append(stage_material)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -1.31))
ground = bpy.context.object
ground.name = "PREVIEW_ONLY_Ground"
ground.data.materials.append(material("PREVIEW_ONLY_Backdrop", (0.12, 0.16, 0.15)))
world = bpy.data.worlds.new("RiverBridge_Showcase_World")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.44, 0.52, 0.58, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.7
showcase.world = world
for name, location, energy, size in [("Key", (3, -6, 13), 2200, 10), ("Fill", (-6, 9, 8), 1700, 9)]:
    bpy.ops.object.light_add(type="AREA", location=location)
    lamp = bpy.context.object
    lamp.name = "PREVIEW_ONLY_" + name
    lamp.data.energy, lamp.data.shape, lamp.data.size = energy, "DISK", size
    lamp.rotation_euler = (Vector((0, 0, 0)) - lamp.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.camera_add(location=(19, -26, 17))
camera = bpy.context.object
camera.name = "PREVIEW_ONLY_Camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 34
camera.rotation_euler = (Vector((0, 0, 0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
showcase.camera = camera
showcase.render.engine = "BLENDER_EEVEE_NEXT"
showcase.render.resolution_x, showcase.render.resolution_y = 1600, 1000
showcase.render.resolution_percentage = 100
showcase.render.image_settings.file_format = "PNG"
showcase.view_settings.view_transform = "AgX"
showcase.render.filepath = str(BUNDLE / "previews/assembled_south_bridge.png")
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.render.render(write_still=True)
camera.location = (6.8, -5.8, 4.6)
camera.data.ortho_scale = 9
camera.rotation_euler = (Vector((0, -2, 0.1)) - camera.location).to_track_quat("-Z", "Y").to_euler()
showcase.render.filepath = str(BUNDLE / "previews/deck_and_rail_detail.png")
bpy.ops.render.render(write_still=True)
report["source"] = str(SOURCE.relative_to(ROOT))
report["source_sha256"] = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
report["status"] = "PASS: actual FBX export/reimport bounds and material names match; Unity validation separate"
(BUNDLE / "reports/blender_export_validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"source": report["source"], "status": report["status"], "assets": [{"name": a["name"], "triangles": a["triangles"], "bounds_delta_m": a["maximum_bounds_delta_m"]} for a in report["assets"]]}, ensure_ascii=False))
