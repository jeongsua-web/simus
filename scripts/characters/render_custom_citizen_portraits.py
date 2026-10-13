"""Render existing modular hair/glasses combinations without changing the blend."""
import bpy
from pathlib import Path
from mathutils import Vector
root = Path(__file__).resolve().parents[2]
out = root / 'web/public/characters/custom'
out.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x, scene.render.resolution_y = 384, 480
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.world.color = (0.7, 0.75, 0.8)
scene.view_settings.view_transform = 'Standard'
scene.frame_set(1)
for obj in scene.objects:
    if obj.type in {'MESH', 'FONT'}:
        obj.hide_render = True
base = [bpy.data.objects[n] for n in ('BODY', 'OUTFIT_TOP', 'OUTFIT_BOTTOM', 'SHOES')]
for obj in base:
    obj.hide_render = False
cam = bpy.data.objects['CAM_Modular_Head']
scene.camera = cam
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 0.76
for index in range(1, 17):
    hairs = [o for o in scene.objects if o.type == 'MESH' and o.name.startswith(f'HAIR_{index:02d}_')]
    for obj in hairs:
        obj.hide_render = False
    bpy.context.view_layer.update()
    bounds = [o.matrix_world @ Vector(p) for o in base + hairs for p in o.bound_box]
    top = max(p.z for p in bounds)
    target = Vector((0, 0, top - 0.24))
    cam.location = target + Vector((0, -5, 0))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    for glasses in ('none', 'square', 'round'):
        for name in ('SQUARE', 'ROUND'):
            bpy.data.objects['GLASSES_' + name].hide_render = glasses != name.lower()
        scene.render.filepath = str(out / f'npc_{index:02d}_{glasses}.png')
        bpy.ops.render.render(write_still=True)
    for obj in hairs:
        obj.hide_render = True
