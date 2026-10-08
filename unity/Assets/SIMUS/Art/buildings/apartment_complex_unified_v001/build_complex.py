import bpy, math, json, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.abspath(__file__))
SRC='/Users/jeongsua/dev/02_SIMUS/unity/Assets/SIMUS_Completed_Map_And_Assets/02_Assets'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
assetcol=bpy.data.collections.new('SIMUS_Apartment_Complex'); scene.collection.children.link(assetcol)
proto={}; placements=[]
keys=['Apartments/APARTMENT_A_MIDRISE','Parks/POCKET_PLAY_PARK','Parks/MODERN_MINIMAL_PARK','Props/STREET_TREE','Props/REUSED_BENCH','Props/WALK_LAMP','Props/PLANTER']
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
# Unified seven-building composition; all tower facades share one orientation.
box('Site_180m_x_164m',(0,0,-.35),(180,164,.7),concrete)
box('Shared landscaped grounds',(0,0,.065),(150,130,.13),grass)
for x in [-79,79]:box('Perimeter road',(x,0,.035),(7,147,.07),asphalt)
for y in [-70,70]:box('Perimeter road',(0,y,.035),(151,7,.07),asphalt)
box('Entrance drive',(0,-77,.04),(8,10,.08),asphalt)
for x in [-74,74]:box('Perimeter walk',(x,0,.14),(3,130,.28),sand)
for y in [-64,64]:box('Perimeter walk',(0,y,.15),(148,3,.28),sand)
for y in [-78,78]:
 for cx in [-43,43]:
  box('Parking apron',(cx,y,.045),(40,5,.09),asphalt)
  for i in range(17):box('Parking stripe',(cx-20+i*2.5,y,.10),(.1,4.9,.012),white)
for x in [-79,79]:
 for y in range(-60,61,12):box('Road center line',(x,y,.08),(.12,3,.01),white)
for y in [-70,70]:
 for x in range(-66,67,12):box('Road center line',(x,y,.08),(3,.12,.01),white)
for x in [-2.7,-1.8,-.9,0,.9,1.8,2.7]:box('Entry crossing',(x,-70,.085),(.48,6,.015),white)
def oval(n,x,y,rx,ry,z,m,inner=0):
 verts=[];faces=[];N=96
 if inner:
  for rxx,ryy in [(rx,ry),(rx-inner,ry-inner)]:
   verts.extend([(x+rxx*math.cos(i*2*math.pi/N),y+ryy*math.sin(i*2*math.pi/N),z) for i in range(N)])
  faces=[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
 else:
  verts=[(x,y,z)]+[(x+rx*math.cos(i*2*math.pi/N),y+ry*math.sin(i*2*math.pi/N),z) for i in range(N)]
  faces=[(0,i+1,(i+1)%N+1) for i in range(N)]
 me=bpy.data.meshes.new(n);me.from_pydata(verts,[],faces);me.materials.append(m);o=bpy.data.objects.new(n,me);assetcol.objects.link(o)
# A single park shared by every building, with oval walking circuit.
oval('Central garden circuit',0,0,25,29,.29,sand,3)
oval('Central communal lawn',0,0,21.6,25.6,.16,grass)
box('Main entrance pedestrian avenue',(0,-47,.14),(8,34,.28),sand)
box('North promenade',(0,31,.155),(110,6,.29),sand)
box('South promenade',(0,-29,.15),(130,6,.30),sand)
for x in [-28,28]:box('Garden side promenade',(x,0,.145),(3,58,.29),sand)
# Same source building, same height, color, roofline and principal orientation.
towers=[('A',-47,47),('A',0,47),('A',47,47),('A',-50,2),('A',50,2),('A',-37,-46),('A',37,-46)]
for i,(kind,x,y) in enumerate(towers,101):
 box('Tower forecourt '+str(i),(x,y,.14),(39,23,.28),concrete)
 inst('APARTMENT_A_MIDRISE','Tower_%s_Type_A'%i,x,y,.29,math.pi/2)
 target=31 if y>25 else (-29 if y< -25 else -14)
 cy=(y-12+target)/2
 box('Entrance connection',(x,cy,.155),(4,abs(y-12-target)+1,.31),sand)
 box('Number sign',(x-16,y-10.5,.95),(2.8,.35,1.5),dark)
 text('Building number '+str(i),str(i),(x-16,y-10.7,.65),.8)
 for dx in [-14,14]:inst('PLANTER','Entrance planter',x+dx,y-9,.29)
# The middle pair opens toward the common park.
for x in [-39,39]:box('Mid block garden access',(x,-14,.165),(28,3,.33),sand)
inst('POCKET_PLAY_PARK','Children playground',-56,-29,.17)
inst('MODERN_MINIMAL_PARK','Quiet residents garden',56,29,.17)
# Central round gathering terrace and seating.
oval('Gathering terrace',0,-13,8,6,.19,concrete)
for x in [-6,6]:inst('REUSED_BENCH','Central terrace bench',x,-13,.2,math.pi/2)
for y in [-23,22]:
 for x in [-13,13]:inst('REUSED_BENCH','Park bench',x,y,.30,0 if y>0 else math.pi)
# Pergola near main arrival plaza.
for x in [-7,7]:
 for y in [-37,-33]:box('Pergola column',(x,y,1.8),(.25,.25,3.6),wood)
for x in range(-7,8):box('Pergola roof slat',(x,-35,3.7),(.16,5,.2),wood)
for y in [-37,-33]:box('Pergola beam',(0,y,3.5),(15,.2,.25),wood)
# Repeated avenues and perimeter planting create a single landscape identity.
for x in [-31,31]:
 for y in [-22,-12,0,12,23]:inst('STREET_TREE','Park avenue tree',x,y,.17,scale=1.3)
for x in [-9,9]:
 for y in [-60,-53,-46]:inst('STREET_TREE','Arrival avenue tree',x,y,.17,scale=1.2)
for x in [-70,70]:
 for y in range(-57,61,7):inst('STREET_TREE','Boundary tree',x,y,.17,scale=1.3)
for y in [-61,61]:
 for x in range(-63,64,7):
  if abs(x)>12:inst('STREET_TREE','Boundary tree',x,y,.17,scale=1.25)
for y in [-20,21]:
 for x in [-65,-44,44,65]:inst('STREET_TREE','Building garden tree',x,y,.17,scale=1.15)
for x in [-25,25]:
 for y in [-23,-7,9,25]:inst('WALK_LAMP','Park lamp',x,y,.30)
for y in [-57,-44,-31]:
 for x in [-5,5]:inst('WALK_LAMP','Arrival lamp',x,y,.30)
for x in [-72,72]:
 for y in [-50,-24,24,50]:inst('WALK_LAMP','Boundary lamp',x,y,.3)
# Entrance framing; lodge sits clear of parking stalls.
for x in [-6,6]:box('Entry pier',(x,-77,1.8),(1,1,3.6),concrete)
box('Entry sign',(-12,-77,1.4),(10,.5,2.2),dark);text('Complex name','SIMUS GARDEN',(-12,-77.28,1.45),.58)
box('Security lodge',(12,-77,1.5),(4,4,3),concrete);box('Security glass',(12,-79.03,1.8),(3.3,.04,1.4),glass);box('Lodge roof',(12,-77,3.15),(4.5,4.5,.25),dark)
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
bpy.ops.object.camera_add(location=(205,-270,245));cam=bpy.context.object;presentation(cam);cam.data.type='ORTHO';cam.data.ortho_scale=250;cam.data.clip_end=3000;cam.rotation_euler=(Vector((0,0,12))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/SIMUS_Apartment_Complex.blend')
scene.render.filepath=ROOT+'/Preview_Isometric.png';bpy.ops.render.render(write_still=True)
cam.location=(0,0,350);cam.rotation_euler=(0,0,0);cam.data.ortho_scale=204;scene.render.filepath=ROOT+'/Preview_Top.png';bpy.ops.render.render(write_still=True)
report={'name':'SIMUS Garden Apartment Complex','site_m':[180,164],'tower_count':7,'parking_bays':64,'source_assets':keys,'placements':placements,'exchange_exports_exclude_presentation':True,'unity_import_verified':False,'navigation_or_colliders_generated':False,'tower_bounds_overlap':False}
# AABB tower footprint audit using source dimensions.
bounds={'A':(34.18,14.94),'B':(22.18,22.89),'C':(20.18,30.09)}
for i,(k,x,y) in enumerate(towers):
 for k2,x2,y2 in towers[i+1:]:
  if abs(x-x2)<(bounds[k][0]+bounds[k2][0])/2 and abs(y-y2)<(bounds[k][1]+bounds[k2][1])/2:report['tower_bounds_overlap']=True
assert not report['tower_bounds_overlap']
open(ROOT+'/Layout_and_Validation.json','w').write(json.dumps(report,ensure_ascii=False,indent=2))
print('COMPLETED',flush=True)
