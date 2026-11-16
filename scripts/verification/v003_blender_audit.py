"""Blender background read-only source/export audit; never save .blend files."""
import bpy,json,pathlib,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
B=ROOT/'assets/library/maps/city_masterplan_v003'
paths=[B/'source/SIMUS_City_Masterplan_v003_EventPlaces.blend',B/'exchange/SIMUS_Event_Places_v001.fbx',B/'exchange/SIMUS_City_Masterplan_v003_QualityPass.fbx']
out={'files':[{ 'path':str(p.relative_to(ROOT)), 'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in paths]}
def capture():
 obs=[]
 for o in bpy.data.objects:
  if o.name in ['EVS_%02d'%i for i in range(1,31)] or o.name in ['FULL_EVENT_30_INTERACT','FULL_EVENT_30_START','FULL_EVENT_30_NPC_WAIT','FULL_EVENT_30_EXIT','EVS_30_mystery_crate_v001']:
   obs.append({'name':o.name,'parent':o.parent.name if o.parent else None,'world_xyz':list(o.matrix_world.translation),'scale':list(o.scale),'type':o.type})
 return {'objects':len(bpy.data.objects),'mesh_objects':sum(o.type=='MESH' for o in bpy.data.objects),'unit_system':bpy.context.scene.unit_settings.system,'scale_length':bpy.context.scene.unit_settings.scale_length,'anchors':obs}
try:
 bpy.ops.wm.open_mainfile(filepath=str(paths[0]));out['blend']=capture()
except RuntimeError as e: out['blend']={'unavailable':str(e),'reason':'Git LFS pointer; source binary absent'}
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(ROOT/'unity/Assets/SIMUS/Scenes/city_masterplan_v003/event_places/SIMUS_Event_Places_v001.fbx'));out['event_fbx_import']=capture()
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(paths[2]));out['quality_fbx_import']=capture()
(ROOT/'docs/verification/v003-blender-source-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('V003_AUDIT_COMPLETE',json.dumps(out['files']))
