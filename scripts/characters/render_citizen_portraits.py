"""Blender background renderer. Preserves source; renders authored PREVIEW variants."""
import bpy
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
out = root / 'web/public/characters'
out.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 384
scene.render.resolution_y = 480
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.world.color = (0.7, 0.75, 0.8)
scene.view_settings.view_transform = 'Standard'
scene.frame_set(1)
cam = bpy.data.objects['CAM_Modular_Head']
scene.camera = cam
cam.data.type = 'ORTHO'
for obj in scene.objects:
    if obj.type in {'MESH', 'FONT'}:
        obj.hide_render = True
for index in range(1, 17):
    prefix = f'PREVIEW_{index:02d}_'
    meshes = [o for o in scene.objects if o.type == 'MESH' and o.name.startswith(prefix)]
    for obj in meshes:
        obj.hide_render = False
    bpy.context.view_layer.update()
    bounds = [o.matrix_world @ Vector(p) for o in meshes for p in o.bound_box]
    left, right = min(p.x for p in bounds), max(p.x for p in bounds)
    top = max(p.z for p in bounds)
    # Portrait crop contains the full head, accessories and shoulders, camera on -Y.
    target = Vector(((left + right) / 2, 0, top - 0.24))
    cam.location = target + Vector((0, -5, 0))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.ortho_scale = 0.76
    scene.render.filepath = str(out / f'npc_{index:02d}.png')
    bpy.ops.render.render(write_still=True)
    for obj in meshes:
        obj.hide_render = True
