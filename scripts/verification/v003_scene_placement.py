#!/usr/bin/env python3
"""Read-only audit of serialized Unity transforms. No Unity asset mutations."""
import csv, hashlib, json, math, pathlib, re
ROOT=pathlib.Path(__file__).resolve().parents[2]
SCENE='unity/Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_EventPlaces.unity'
def vec(block, key):
 m=re.search(r'  '+key+r': \{([^}]+)\}',block)
 return [float(x.split(':')[1]) for x in m[1].split(',')] if m else []
def multiply(a,b): return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def matrix(p,q,s):
 x,y,z,w=q; r=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
 return [[r[i][j]*s[j] for j in range(3)]+[p[i]] for i in range(3)]+[[0,0,0,1]]
def read_scene():
 objects={}; transforms={}
 for m in re.finditer(r'^--- !u!(\d+) &(\d+)[^\n]*\n(.*?)(?=^--- !u!|\Z)',(ROOT/SCENE).read_text(),re.M|re.S):
  kind,id,b=m.groups(); id=int(id)
  if kind=='1':
   n=re.search(r'^  m_Name: (.*)$',b,re.M)
   if n: objects[id]=n[1]
  if kind=='4' and 'm_LocalPosition:' in b:
   transforms[id]={'gameobject':int(re.search(r'm_GameObject: \{fileID: (\d+)',b)[1]),'parent':int(re.search(r'm_Father: \{fileID: (\d+)',b)[1]),'position':vec(b,'m_LocalPosition'),'rotation':vec(b,'m_LocalRotation'),'scale':vec(b,'m_LocalScale')}
 def resolve(id):
  t=transforms[id]
  if 'world' in t:return t
  local=matrix(t['position'],t['rotation'],t['scale']); name=objects.get(t['gameobject'],'?')
  if t['parent'] in transforms:
   parent=resolve(t['parent']);t['world']=multiply(parent['world'],local);t['path']=parent['path']+'/'+name
  else:t['world']=local;t['path']=name
  t['name']=name;t['world_xyz']=[round(t['world'][i][3],6) for i in range(3)]
  return t
 return [resolve(id) for id in transforms]
if __name__=='__main__':
 ts=read_scene(); chosen=[t for t in ts if re.match(r'^(EVS_\d\d$|EXHIBITION_\d\d|EV_\d\d|EVENT_\d\d|SIMUS_Event|.*SPAWN|.*Spawn)',t['name'])]
 out={'scene':SCENE,'scene_sha256':hashlib.sha256((ROOT/SCENE).read_bytes()).hexdigest(),'transforms':chosen}
 (ROOT/'docs/verification/v003-scene-transforms.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
 for t in chosen: print(t['path'],t['world_xyz'],t['scale'])
