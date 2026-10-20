"""Run with Blender --background --python. Only writes isolated Phase 8 assets."""
import bpy
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / 'assets/library/props/city_v002_phase8_street_kit_v001'
UNITY = ROOT / 'unity/Assets/SIMUS/Art/props/city_v002_phase8'
for folder in (BUNDLE/'source', BUNDLE/'exports', BUNDLE/'previews', BUNDLE/'reports', UNITY):
    folder.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.scale_length = 1

def material(name, colour, roughness=0.85):
    value = tuple(int(colour[i:i+2], 16)/255 for i in (0,2,4)) + (1,)
    mat = bpy.data.materials.new('Phase8_' + name)
    mat.diffuse_color = value
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = value
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0
    return mat

mats = {key: material(key, colour) for key, colour in {
    'WarmStone':'D6CDB9', 'DarkMetal':'455864', 'HoneyWood':'A67C55',
    'Soil':'695D4A', 'Leaf':'598B69', 'LeafLight':'8EAF7C',
    'FlowerCream':'F1E6CB', 'FlowerCoral':'DD9778', 'LampCream':'F4D99B',
}.items()}

parts = []
def finish(obj, mat):
    obj.data.materials.append(mats[mat])
    parts.append(obj)
    return obj

def box(name, loc, scale, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Small edge chamfer', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, mat)

def cylinder(name, loc, radius, depth, mat, vertices=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, mat)

def leaf(name, loc, scale, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat)

def merge(name):
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + '_Mesh'
    bpy.context.scene.cursor.location = (0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    parts.clear()
    return obj

# Planter 1.8 x 0.7 m. Sturdy cream walls, inset earth, faceted shrubs and blossoms.
box('Base', (0,0,.08), (1.72,.62,.16), 'WarmStone', .035)
box('Front', (0,-.305,.29), (1.8,.09,.36), 'WarmStone', .025)
box('Back', (0,.305,.29), (1.8,.09,.36), 'WarmStone', .025)
box('EndL', (-.855,0,.29), (.09,.55,.36), 'WarmStone', .025)
box('EndR', (.855,0,.29), (.09,.55,.36), 'WarmStone', .025)
box('Earth', (0,0,.405), (1.63,.5,.04), 'Soil')
for i, x in enumerate((-.61,-.2,.2,.61)):
    leaf('Shrub', (x,0,.58), (.27,.235,.23), 'Leaf' if i%2 else 'LeafLight')
for i,x in enumerate((-.64,-.18,.22,.63)):
    leaf('Blossom', (x,-.1,.76), (.075,.075,.045), 'FlowerCoral' if i%2 else 'FlowerCream')
planter = merge('Phase8_Planter')

# Bench 2 x .7 x .85 m, six honey wood seat slats and a three-slat back.
for x in (-.75,.75):
    for y in (-.25,.25):
        box('Foot', (x,y,.215), (.09,.09,.43), 'DarkMetal', .01)
    box('SeatRail', (x,0,.4), (.11,.7,.08), 'DarkMetal', .01)
    box('BackSupport', (x,.29,.62), (.07,.07,.46), 'DarkMetal', .01)
for y in (-.25,-.15,-.05,.05,.15,.25):
    box('SeatSlat', (0,y,.455), (2,.085,.07), 'HoneyWood', .012)
for z in (.585,.695,.805):
    box('BackSlat', (0,.295,z), (2,.075,.09), 'HoneyWood', .012)
bench = merge('Phase8_Bench')

# Lamp 0.4 x 0.4 x 4.5 m, daytime opaque lens; no light/animation component.
box('Foot', (0,0,.06), (.36,.36,.12), 'DarkMetal', .025)
cylinder('Post', (0,0,1.94), .058, 3.8, 'DarkMetal')
cylinder('Collar', (0,0,3.78), .105, .1, 'HoneyWood')
box('Lens', (0,0,4.085), (.27,.27,.48), 'LampCream', .025)
for x in (-.145,.145):
    for y in (-.145,.145):
        box('LanternFrame', (x,y,4.085), (.035,.035,.53), 'DarkMetal', .005)
box('LanternBase', (0,0,3.81), (.36,.36,.06), 'DarkMetal', .015)
bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=.2828427, radius2=.13, depth=.2, location=(0,0,4.4), rotation=(0,0,math.pi/4))
finish(bpy.context.object, 'DarkMetal')
lamp = merge('Phase8_Streetlamp')
objects = [planter, bench, lamp]

# Export all three modules at ground-centred origin, selected by stable mesh names.
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.select_set(True)
fbx = BUNDLE/'exports/phase8_street_kit.fbx'
bpy.ops.export_scene.fbx(filepath=str(fbx), use_selection=True, object_types={'MESH'},
    axis_forward='-Z', axis_up='Y', apply_unit_scale=True, global_scale=1,
    apply_scale_options='FBX_SCALE_UNITS', bake_anim=False, use_mesh_modifiers=True,
    path_mode='RELATIVE', add_leaf_bones=False)
(UNITY/'phase8_street_kit.fbx').write_bytes(fbx.read_bytes())

# Source is arranged for editing; each module still has its own ground origin.
planter.location = (-2.6,0,0)
bench.location = (0,0,0)
lamp.location = (2.2,0,0)
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = planter
bpy.ops.wm.save_as_mainfile(filepath=str(BUNDLE/'source/phase8_street_kit.blend'))

# Actual Blender-rendered asset preview (not a Unity Game View).
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1200
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('Preview World')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.65,.74,.78,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .6
bpy.ops.object.light_add(type='AREA', location=(-3,-4,8))
bpy.context.object.data.energy = 1000
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 6
bpy.context.object.rotation_euler = (Vector((0,0,1))-bpy.context.object.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(8,-12,8))
camera = bpy.context.object
camera.rotation_euler = (Vector((0,0,1.7))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 8.3
scene.camera = camera
scene.view_settings.view_transform = 'Standard'
scene.render.filepath = str(BUNDLE/'previews/phase8_street_kit.png')
bpy.ops.render.render(write_still=True)

# Read source back, then actual FBX reimport; no saved existing project is opened.
bpy.ops.wm.open_mainfile(filepath=str(BUNDLE/'source/phase8_street_kit.blend'))
source_meshes = sorted(o.name for o in bpy.context.scene.objects if o.type=='MESH')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(fbx))
result = {'blender_version': bpy.app.version_string, 'source_reopen_meshes': source_meshes,
          'fbx_sha256': hashlib.sha256(fbx.read_bytes()).hexdigest(), 'objects':[]}
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    coords = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    mins = [min(v[i] for v in coords) for i in range(3)]
    maxs = [max(v[i] for v in coords) for i in range(3)]
    obj.data.calc_loop_triangles()
    result['objects'].append({'name':obj.name, 'bounds_min_xyz':mins, 'bounds_max_xyz':maxs,
        'dimensions_xyz':[b-a for a,b in zip(mins,maxs)], 'vertices':len(obj.data.vertices),
        'triangles':len(obj.data.loop_triangles), 'materials':[m.name for m in obj.data.materials],
        'object_location':list(obj.location), 'finite_bounds':all(math.isfinite(c) for c in mins+maxs)})
assert len(result['objects']) == 3
for item in result['objects']:
    assert item['finite_bounds'] and abs(item['bounds_min_xyz'][2]) < .00001
assert (UNITY/'phase8_street_kit.fbx').read_bytes() == fbx.read_bytes()
(BUNDLE/'reports/blender-validation.json').write_text(json.dumps(result, indent=2)+'\n')
print('PHASE8_KIT_VALIDATED', json.dumps(result))
