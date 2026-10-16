"""Read-only Blender source portal geometry evidence; never saves or exports assets."""
import bpy
import hashlib
import json
import pathlib
import re
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'docs/verification/city-rebuild-v002-portal-source-evidence.json'
measurements = json.loads((ROOT / 'docs/planning/city_rebuild_v002/asset_measurements.json').read_text(encoding='utf-8'))
result = {'schema':'simus-v002-readonly-portal-source-evidence-v1', 'blender_version':bpy.app.version_string,
          'status':'geometry evidence only; Unity transformed exterior support and body clearance require execution', 'assets':[]}

def bounds(points):
    return {'min':[min(p[i] for p in points) for i in range(3)], 'max':[max(p[i] for p in points) for i in range(3)]}

for asset in measurements['assets']:
    if not asset['asset_key'].startswith(('COMMERCIAL','HOUSE','VILLA','APARTMENT','DEPARTMENT')):
        continue
    path = ROOT / asset['source']
    original_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    evidence=[]
    for obj in meshes:
        if not re.search(r'entry|entrance|door|ramp|step|accessible|glass|glaz|leaf|frame', obj.name, re.I):
            continue
        points=[obj.matrix_world @ v.co for v in obj.data.vertices]
        if not points:
            continue
        bound=bounds(points)
        # Ground-floor evidence only. Preserve all actual source names and surface normals.
        if bound['min'][2] > 3.5:
            continue
        normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
        faces=[]
        for poly in obj.data.polygons:
            normal=(normal_matrix @ poly.normal).normalized()
            centre=obj.matrix_world @ poly.center
            faces.append({'centre':list(centre),'normal':list(normal),'area_local':poly.area,
                          'vertices_source_xyz':[list(obj.matrix_world @ obj.data.vertices[i].co) for i in poly.vertices]})
        evidence.append({'name':obj.name,'bounds_source_xyz':bound,'vertices':len(points),
                         'faces':faces,'centre':[(a+b)/2 for a,b in zip(bound['min'],bound['max'])]})
    entry={'asset_key':asset['asset_key'],'source':asset['source'],'sha256_before':original_hash,
           'sha256_after':hashlib.sha256(path.read_bytes()).hexdigest(),'source_hash_matches_design':original_hash == asset['source_sha256'],
           'mesh_count':len(meshes),'portal_objects':evidence}
    result['assets'].append(entry)
    print('PORTAL_AUDIT',asset['asset_key'],len(evidence),flush=True)
    OUTPUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('PORTAL_AUDIT_COMPLETE',len(result['assets']),flush=True)
