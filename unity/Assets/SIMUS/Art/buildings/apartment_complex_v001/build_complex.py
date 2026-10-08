import bpy, math, json, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.abspath(__file__))
SRC='/Users/jeongsua/dev/02_SIMUS/unity/Assets/SIMUS_Completed_Map_And_Assets/02_Assets'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
assetcol=bpy.data.collections.new('SIMUS_Apartment_Complex'); scene.collection.children.link(assetcol)
proto={}; placements=[]
keys=['Apartments/APARTMENT_A_MIDRISE','Apartments/APARTMENT_B_MIDRISE','Apartments/APARTMENT_C_MIDRISE','Parks/POCKET_PLAY_PARK','Parks/MODERN_MINIMAL_PARK','Props/STREET_TREE','Props/REUSED_BENCH','Props/WALK_LAMP','Props/PLANTER']
for key in keys:
 with bpy.data.libraries.load(SRC+'/'+key+'.blend',link=False) as (a,b): b.collections=list(a.collections)
 cols=b.collections
 for col in cols: scene.collection.children.link(col)
 bpy.context.view_layer.update(); dg=bpy.context.evaluated_depsgraph_get(); baked=[]
 for o in list({o for c in cols for o in c.all_objects}):
  if o.type!='MESH': continue
  me=bpy.data.meshes.new_from_object(o.evaluated_get(dg),depsgraph=dg); me.transform(o.matrix_world)
  n=bpy.data.objects.new('BAKED',me); assetcol.objects.link(n); baked.append(n)
 bpy.ops.object.select_all(action='DESELECT')
 for o in baked:o.select_set(True)
 bpy.context.view_layer.objects.active=baked[0]; bpy.ops.object.join(); p=bpy.context.object; p.name=key.split('/')[-1]
 proto[key.split('/')[-1]]=p
 for c in cols:
  for o in list(c.all_objects): bpy.data.objects.remove(o,do_unlink=True)
  bpy.data.collections.remove(c)
 assetcol.objects.unlink(p)
 print('Loaded',key,flush=True)
def mat(name,c):
 m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.use_nodes=True; m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*c,1); return m
concrete=mat('Warm stone',(.55,.56,.52)); asphalt=mat('Road asphalt',(.13,.16,.18)); grass=mat('Lawn',(.25,.39,.17)); white=mat('Road paint',(.87,.89,.84)); dark=mat('Graphite metal',(.10,.15,.17)); wood=mat('Warm wood',(.35,.20,.10)); glass=mat('Guardhouse glass',(.19,.37,.42)); sand=mat('Path warm paving',(.65,.59,.47))
def move(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 assetcol.objects.link(o); return o
def box(n,loc,dim,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=move(bpy.context.object); o.name=n; o.dimensions=dim; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m); return o
def inst(key,n,x,y,z=.17,rot=0,scale=1):
 p=proto[key]; o=bpy.data.objects.new(n,p.data); assetcol.objects.link(o); o.location=(x,y,z); o.rotation_euler.z=rot; o.scale=(scale,)*3
 placements.append(dict(name=n,source=key,position=[x,y,z],rotation_degrees=round(math.degrees(rot),2),scale=scale)); return o
def text(n,s,loc,size,rot=(math.pi/2,0,0)):
 cu=bpy.data.curves.new(n,'FONT');cu.body=s;cu.align_x='CENTER';cu.size=size;cu.extrude=.015;o=bpy.data.objects.new(n,cu);assetcol.objects.link(o);o.location=loc;o.rotation_euler=rot;cu.materials.append(white)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
box('Site_156m_x_180m',(0,0,-.35),(156,180,.7),concrete)
box('Central landscape',(0,0,.065),(123,143,.13),grass)
# Continuous ring with nonoverlapping straight sections.
for x in [-66,66]:box('Ring road',(x,0,.035),(7,159,.07),asphalt)
for y in [-76,76]:box('Ring road',(0,y,.035),(125,7,.07),asphalt)
box('Main entrance drive',(0,-84.75,.036),(8,10.5,.072),asphalt)
for x in [-61.5,61.5]:box('Inner pavement',(x,0,.13),(2,143,.26),sand)
for y in [-71.5,71.5]:box('Inner pavement',(0,y,.13),(121,2,.26),sand)
box('Central promenade',(0,0,.158),(5,141,.28),sand)
for y in [-23,26]:box('Cross promenade',(0,y,.146),(122,3,.28),sand)
# 64 parking bays, open toward ring road.
for y in [-83,83]:
 for side in [-1,1]:
  cx=side*32
  box('Parking apron',(cx,y,.045),(40,5.4,.09),asphalt)
  for i in range(17):box('Parking bay line',(cx-20+i*2.5,y,.098),(.10,5,.015),white)
  box('Parking back line',(cx,y+(2.55 if y>0 else -2.55),.098),(40,.1,.015),white)
for x in [-66,66]:
 for y in range(-66,68,12):box('Road center dash',(x,y,.081),(.12,3,.012),white)
for y in [-76,76]:
 for x in range(-54,55,12):box('Road center dash',(x,y,.081),(3,.12,.012),white)
# Main pedestrian crossing north of entry.
for x in [-2.7,-1.8,-.9,0,.9,1.8,2.7]:box('Entry crossing',(x,-76,.085),(.48,6,.016),white)
towers=[('A',-43,-46),('B',43,-46),('B',-43,3),('C',43,3),('C',-43,48),('A',43,48)]
for i,(kind,x,y) in enumerate(towers,101):
 box('Tower %s forecourt'%i,(x,y,.14),(30,39,.28),concrete)
 inst('APARTMENT_'+kind+'_MIDRISE','Tower_%s_Type_%s'%(i,kind),x,y,.29)
 box('Entrance path',(x/2,y,.152),(abs(x),2.4,.28),sand)
 # Wayfinding at site edge, separate from original facade.
 box('Building number plinth',(x-11,y-18,.85),(2.8,.35,1.3),dark); text('Number_%s'%i,str(i),(x-11,y-18.19,.5),.8)
 for dx in [-11,11]:inst('PLANTER','Entrance planter',x+dx,y-16,.29)
inst('POCKET_PLAY_PARK','Playground',-13,-43)
inst('MODERN_MINIMAL_PARK','Residents garden',13,43)
# Green rooms with seating, trees, and links.
for y in [-60,-10,12,62]:
 for x in [-14,14]:
  box('Garden seating terrace',(x,y,.14),(9,6,.28),sand)
  inst('REUSED_BENCH','Garden bench',x,y+2,.29)
  inst('REUSED_BENCH','Garden bench',x,y-2,.29,math.pi)
for y in [-63,-32,-15,16,34,64]:
 for x in [-23,23]:inst('STREET_TREE','Garden tree',x,y,.17,scale=1.15)
for x in [-74,74]:
 for y in range(-68,70,12):inst('STREET_TREE','Boundary tree',x,y,.02,scale=1.1)
for y in range(-64,65,16):
 for x in [-4,4]:inst('WALK_LAMP','Promenade lamp',x,y)
for x in [-60,60]:
 for y in [-60,-24,26,62]:inst('WALK_LAMP','Ring footpath lamp',x,y)
# Gate, security lodge and low front walls with clear 8m vehicle gap.
for x in [-7,7]:box('Gate pier',(x,-86,1.5),(1.1,1.1,3),concrete)
box('Gate name panel',(-14,-86,1.35),(11,.5,2.1),dark);text('Gate name','SIMUS GARDEN',(-14,-86.28,1.3),.65)
box('Security lodge',(9,-83,1.45),(4,4,2.9),concrete);box('Security window',(9,-85.02,1.7),(3.3,.04,1.4),glass);box('Lodge roof',(9,-83,3),(4.6,4.6,.25),dark)
for x in [-44,44]:box('Low boundary wall',(x,-89,.5),(64,.3,1),concrete)
# export geometry only
bpy.ops.object.select_all(action='DESELECT')
for o in assetcol.all_objects:o.select_set(True)
bpy.context.view_layer.objects.active=next(iter(assetcol.objects))
bpy.ops.export_scene.gltf(filepath=ROOT+'/SIMUS_Apartment_Complex.glb',use_selection=True,export_format='GLB')
originals=[]
for o in assetcol.all_objects:
 if o.type=='MESH': originals.append((o,o.data));o.data=o.data.copy()
bpy.ops.export_scene.fbx(filepath=ROOT+'/SIMUS_Apartment_Complex.fbx',use_selection=True,object_types={'MESH'},apply_unit_scale=True,axis_forward='-Z',axis_up='Y',bake_anim=False)
for o,me in originals:tmp=o.data;o.data=me;bpy.data.meshes.remove(tmp)
# presentation never included in exchange exports
pres=bpy.data.collections.new('Presentation_only');scene.collection.children.link(pres)
def presentation(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 pres.objects.link(o)
floor=box('Preview backdrop',(0,0,-1.05),(2000,2000,.5),mat('Backdrop',(.72,.74,.70)));presentation(floor)
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.78,.82,.9,1)
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.7
bpy.ops.object.light_add(type='SUN',location=(0,0,150));sun=bpy.context.object;presentation(sun);sun.rotation_euler=(.45,-.55,-.5);sun.data.energy=2.5;sun.data.angle=.22
bpy.ops.object.camera_add(location=(220,-280,260));cam=bpy.context.object;presentation(cam);cam.data.type='ORTHO';cam.data.ortho_scale=260;cam.data.clip_end=3000;cam.rotation_euler=(Vector((0,0,12))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1600;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/SIMUS_Apartment_Complex.blend')
scene.render.filepath=ROOT+'/Preview_Isometric.png';bpy.ops.render.render(write_still=True)
cam.location=(0,0,350);cam.rotation_euler=(0,0,0);cam.data.ortho_scale=204;scene.render.filepath=ROOT+'/Preview_Top.png';bpy.ops.render.render(write_still=True)
report={'name':'SIMUS Garden Apartment Complex','site_m':[156,180],'tower_count':6,'parking_bays':64,'source_assets':keys,'placements':placements,'exchange_exports_exclude_presentation':True,'unity_import_verified':False,'navigation_or_colliders_generated':False,'tower_bounds_overlap':False}
# AABB tower footprint audit using source dimensions.
bounds={'A':(14.94,34.18),'B':(22.18,22.89),'C':(20.18,30.09)}
for i,(k,x,y) in enumerate(towers):
 for k2,x2,y2 in towers[i+1:]:
  if abs(x-x2)<(bounds[k][0]+bounds[k2][0])/2 and abs(y-y2)<(bounds[k][1]+bounds[k2][1])/2:report['tower_bounds_overlap']=True
assert not report['tower_bounds_overlap']
open(ROOT+'/Layout_and_Validation.json','w').write(json.dumps(report,ensure_ascii=False,indent=2))
print('COMPLETED',flush=True)
