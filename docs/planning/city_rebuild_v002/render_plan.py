"""Render measured planning geometry only; never opens or writes Unity assets."""
import json
import hashlib
import math
import os
from pathlib import Path

os.environ.setdefault('MPLCONFIGDIR', '/tmp/simus-map-mpl')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Circle, Patch
from matplotlib.font_manager import FontProperties

BASE = Path(__file__).resolve().parent
FONT = FontProperties(fname='/System/Library/Fonts/Supplemental/AppleGothic.ttf')
plt.rcParams['font.family'] = FONT.get_name()
plt.rcParams['svg.fonttype'] = 'path'
plt.rcParams['axes.unicode_minus'] = False
COLORS = {'commercial':'#cb9774','house':'#e4c692','villa':'#d0b09a',
          'apartment':'#a8bbd0','campus':'#829da1','department':'#c59485',
          'residential':'#dac092','campus_building':'#829da1'}

def strip(ax, points, width, color, zorder=2, alpha=1):
    """Round joined corridor in world metres; segment bounds keep true width."""
    if not points or width <= 0:
        return
    for a,b in zip(points, points[1:]):
        dx,dz = b[0]-a[0],b[1]-a[1]
        length = math.hypot(dx,dz)
        if not length:
            continue
        nx,nz = -dz/length*width/2,dx/length*width/2
        ax.add_patch(Polygon([(a[0]+nx,a[1]+nz),(b[0]+nx,b[1]+nz),
                             (b[0]-nx,b[1]-nz),(a[0]-nx,a[1]-nz)],
                            facecolor=color,edgecolor='none',zorder=zorder,alpha=alpha))
    for x,z in points:
        ax.add_patch(Circle((x,z),width/2,facecolor=color,edgecolor='none',zorder=zorder,alpha=alpha))

def center(item):
    c=item.get('center',item)
    return c.get('x',0),c.get('z',0)

def footprint(item):
    if item.get('footprint_polygon'):
        return item['footprint_polygon']
    x,z=center(item)
    theta=math.radians(item.get('yaw',0))
    w,d=item['width']/2,item['depth']/2
    return [[x+u*math.cos(theta)+v*math.sin(theta),
             z-u*math.sin(theta)+v*math.cos(theta)] for u,v in [(-w,-d),(w,-d),(w,d),(-w,d)]]

def draw(data, name, network=False, campus_only=False):
    fig,ax=plt.subplots(figsize=(18,17))
    fig.patch.set_facecolor('#f7f7f2')
    ax.set_facecolor('#f0efe8')
    ex=data['extent']
    ax.set_xlim(ex['xmin']-8,ex['xmax']+8)
    ax.set_ylim(ex['zmin']-8,ex['zmax']+8)
    ax.set_aspect('equal',adjustable='box')
    for district in data.get('districts',[]):
        color={'campus':'#e1e9df','park':'#cee0bd','residential':'#eee5d7','commercial':'#f0e1d7'}.get(district.get('type'),'#e9e7dd')
        ax.add_patch(Polygon(district['polygon'],facecolor=color,edgecolor='#adae9c',linewidth=.7,zorder=0))
    campus=data['campus']
    ax.add_patch(Polygon(footprint(campus),facecolor='#e1e9df',edgecolor='#9caa95',linewidth=1,zorder=1))
    park=data.get('park',{})
    if park.get('polygon'):
        ax.add_patch(Polygon(park['polygon'],facecolor='#c9ddb7',edgecolor='#9cb58d',zorder=1))
    measured=json.loads((BASE/'asset_measurements.json').read_text())
    for feature in measured['campus'].get('features',[]):
        short=feature['name'].split('__')[-1]
        if short not in ['Central garden','Basketball court','Tennis court','Field lawn']:
            continue
        bounds=feature['bounds_design_unity_xz'];lo,hi=bounds['min'],bounds['max']
        col='#d4ac86' if 'court' in short else '#b9cf9e'
        ax.add_patch(Polygon([[lo[0],lo[1]],[hi[0],lo[1]],[hi[0],hi[1]],[lo[0],hi[1]]],
                             facecolor=col,edgecolor='#a4b390',linewidth=.6,zorder=1.5))
        if short!='Field lawn':
            label={'Central garden':'기존 중앙정원','Basketball court':'농구장','Tennis court':'테니스장'}[short]
            ax.text((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,label,fontsize=6,ha='center',va='center',zorder=9)
    for rest in park.get('rest_areas',[]):
        ax.add_patch(Circle((rest['x'],rest['z']),rest['radius'],facecolor='#d9d2b8',edgecolor='#b7ac8d',zorder=6))
        ax.text(rest['x'],rest['z'],rest['id']+'\n휴식',ha='center',va='center',fontsize=7,zorder=14)
    for module in park.get('reuse_modules',[]):
        ax.add_patch(Polygon(footprint(module),facecolor='#d9d2b8',edgecolor='#9b927b',linewidth=.7,zorder=6))
        ax.annotate(module['id']+' 12×12m 재사용', (module['x'],module['z']),xytext=(6,-20),textcoords='offset points',fontsize=7,zorder=14)
    for road in data['roads']:
        total=road['carriageway_width']+road['sidewalk_left']+road['sidewalk_right']
        strip(ax,road['points'],total,'#d7d1c5',2)
        strip(ax,road['points'],road['carriageway_width'],'#818992',3)
        pts=road['points']
        ax.plot(*zip(*pts),color='#e6e3d6',linewidth=.75,linestyle=(0,(5,5)),zorder=4)
        mid=pts[len(pts)//2]
        label=f"{road['id']}  {road['carriageway_width']:g}m + 보도 {road['sidewalk_left']:g}/{road['sidewalk_right']:g}m"
        ax.annotate(label,mid,xytext=(5,6),textcoords='offset points',fontsize=7,
                    color='#253747',bbox=dict(facecolor='white',alpha=.85,edgecolor='none',pad=2),zorder=12)
    for turn in data.get('turning_spaces',[]):
        if 'radius' in turn:
            ax.add_patch(Circle((turn['x'],turn['z']),turn['radius'],facecolor='none',edgecolor='#5e6570',linestyle='--',linewidth=.8,zorder=13))
            text=f"회차 R{turn['radius']:g}m"
        else:
            ax.add_patch(Polygon(footprint(turn),facecolor='none',edgecolor='#5e6570',linestyle='--',linewidth=.8,zorder=13))
            text=f"회차 {turn['width']:g}×{turn['depth']:g}m"
        ax.annotate(text,(turn['x'],turn['z']),xytext=(-5,10),textcoords='offset points',fontsize=6.5,zorder=14)
    for edge in data.get('pedestrian_edges',[]):
        strip(ax,edge['points'],edge['width'],'#eeece1' if edge.get('kind')!='crossing' else '#f8f7e7',5)
    field=campus.get('field',{})
    if field:
        ax.add_patch(Polygon(footprint(field),facecolor='#91b881',edgecolor='#edf0db',linewidth=1,zorder=6))
        fx,fz=center(field)
        ax.text(fx,fz,'기존 운동장\n'+f"{field['width']:.1f}×{field['depth']:.1f}m",ha='center',va='center',fontsize=9,zorder=10)
    plaza=campus.get('plaza',{})
    if plaza and ('width' in plaza or plaza.get('footprint_polygon')):
        ax.add_patch(Polygon(footprint(plaza),facecolor='#e1d4b6',edgecolor='#b6a98a',linewidth=.7,zorder=6))
        px,pz=center(plaza)
        ax.text(px,pz-3,'계획 중앙광장\n'+f"{plaza['width']:g}×{plaza['depth']:g}m",ha='center',va='center',fontsize=7,zorder=14)
    evidence_path=BASE/'campus-footprint-evidence.json'
    evidence={o['name']:o['top_triangles_blender_xy'] for o in json.loads(evidence_path.read_text())['objects']} if evidence_path.exists() else {}
    all_buildings = campus.get('components',[]) + data.get('buildings',[])
    for b in all_buildings:
        if not b.get('footprint_polygon') and not ('width' in b and 'depth' in b):
            continue
        kind=b.get('type','campus')
        if kind=='residential':
            kind='villa' if '/villas/' in b.get('asset','') else 'house'
        if 'DEPARTMENT' in b.get('asset',''):
            kind='department'
        col=COLORS.get(kind,'#adbdad')
        body_name=next((n for n in b.get('split_objects',[]) if n in evidence),None)
        if body_name:
            ax.add_patch(Polygon(footprint(b),facecolor='none',edgecolor='#7e8b88',linewidth=.6,linestyle='--',zorder=7))
            delta=b.get('delta_from_original',[0,0]);cx,cz=center(campus)
            for tri in evidence[body_name]:
                ax.add_patch(Polygon([[p[0]+cx+delta[0],p[1]+cz+delta[1]] for p in tri],
                                     facecolor=col,edgecolor='none',zorder=8,alpha=.55 if network else 1))
        else:
            ax.add_patch(Polygon(footprint(b),facecolor=col,edgecolor='#59615e',linewidth=.8,zorder=7,alpha=.55 if network else 1))
        x,z=center(b)
        if b.get('footprint_polygon') and 'x' not in b and 'center' not in b:
            poly=footprint(b); x=sum(p[0] for p in poly)/len(poly); z=sum(p[1] for p in poly)/len(poly)
        label=b.get('id',b.get('name',''))
        if campus_only or (b.get('width',0)>=12 and b.get('depth',0)>=12):
            label+=f"\n{b.get('width',0):.1f}×{b.get('depth',0):.1f}"
        ax.text(x,z,label,ha='center',va='center',fontsize=6.3 if not campus_only else 8,zorder=10)
        entrance=b.get('entrance')
        if entrance and 'x' in entrance:
            ax.plot(entrance['x'],entrance['z'],marker='D',markersize=3,color='#b63d31',zorder=13)
    for j in data.get('intersections',[]):
        ax.annotate(j['id'],(j['x'],j['z']),xytext=(-5,-13),textcoords='offset points',
                    color='#123b53',fontsize=7,fontweight='bold',zorder=15)
    for facility in data.get('crossing_facilities',[]):
        ax.plot(facility['x'],facility['z'],marker='s',markersize=3,markerfacecolor='none',markeredgecolor='#614276',zorder=15)
        ax.annotate(facility['id'],(facility['x'],facility['z']),xytext=(5,-7),textcoords='offset points',fontsize=5.5,color='#614276',zorder=15)
    nodes={n['id']:n for n in data.get('pedestrian_nodes',[])}
    if network:
        for e in data.get('pedestrian_edges',[]):
            ax.plot(*zip(*e['points']),color='#008b81',linewidth=1,alpha=.5,zorder=11)
        for n in nodes.values():
            major=n['kind'] in ['gate','pedestrian_gate','plaza','rest_area'] or n['id'] in ['MN_GATE','MS_GATE','MN_PARK']
            ax.plot(n['x'],n['z'],'o',markersize=3 if major else 1.5,color='#00695f',zorder=15)
            if major:
                ax.annotate(n['id'],(n['x'],n['z']),xytext=(3,4),textcoords='offset points',fontsize=7,zorder=16)
        route_colors=['#c94e4e','#5e70be','#d39026']
        for route,col in zip(data.get('routes',[]),route_colors):
            seq=route.get('expanded_nodes',route.get('nodes',[]))
            for a,b in zip(seq,seq[1:]):
                matching=[e for e in data['pedestrian_edges'] if {e['from'],e['to']}=={a,b}]
                if matching:
                    e=min(matching,key=lambda item:item.get('length',math.inf))
                    ax.plot(*zip(*e['points']),color=col,linewidth=2,alpha=.85,zorder=17)
    for n in nodes.values():
        if 'gate' in n.get('kind',''):
            label={'GATE_MAIN':'정문 / 접근점','GATE_BACK':'후문 / 접근점','GATE_PARK':'공원 보행문 / 접근점'}.get(n['id'],'문 / 접근점')
            ax.annotate(label,
                        (n['x'],n['z']),xytext=(10,10),textcoords='offset points',fontsize=9,
                        color='#9a3329',bbox=dict(facecolor='white',edgecolor='#bb8171',pad=3),zorder=18)
    title='SIMUS 대학가 리빌드 v002 — '+('NPC 보행 연결망' if network else '캠퍼스 상세' if campus_only else '실측 기반 탑뷰 배치도')
    ax.set_title(title+'\n승인 대기 설계 · Unity XZ / 1 unit = 1m · Unity 렌더 아님',fontsize=17,pad=18)
    ax.set_xlabel('Unity X (m)',fontsize=11);ax.set_ylabel('Unity Z (m) / 북쪽 +Z',fontsize=11)
    ax.grid(color='#bcbcaf',alpha=.25,linewidth=.5,zorder=0)
    if campus_only:
        cx,cz=center(campus)
        ax.set_xlim(cx-campus['width']/2-15,cx+campus['width']/2+15)
        ax.set_ylim(cz-campus['depth']/2-15,cz+campus['depth']/2+15)
    display={'commercial':'상가','house':'단독주택','villa':'빌라','apartment':'아파트','campus':'학교','department':'백화점'}
    handles=[Patch(facecolor=v,edgecolor='#59615e',label=display[k]) for k,v in COLORS.items() if k in display]
    handles += [Patch(facecolor='#818992',label='차도'),Patch(facecolor='#d7d1c5',label='보도'),
                Patch(facecolor='#eeece1',label='보행로'),Patch(facecolor='#c9ddb7',label='녹지')]
    if network:
        from matplotlib.lines import Line2D
        handles += [Line2D([0],[0],color=c,linewidth=2,label=r['id']) for r,c in zip(data.get('routes',[]),['#c94e4e','#5e70be','#d39026'])]
    ax.legend(handles=handles,loc='upper left',bbox_to_anchor=(0,-.06),ncol=5,fontsize=8,frameon=False)
    fig.text(.5,.035,'건물 ID → buildings.csv / campus-placements.csv · 출입점 ◇는 실문 확인 전 접근점 포함\n캠퍼스 채움 = 실측 몸체 투영 / 점선 = 지붕·캐노피·계단 여유 범위 · 도로 폭은 월드 미터로 표현\n회전부 곡면은 설계 표기이며 차량 궤적·NavMesh·카메라 실행 검증은 승인 후',ha='center',fontsize=9)
    x0,x1=ax.get_xlim();z0,z1=ax.get_ylim()
    bx,bz=x0+8,z0+8
    ax.plot([bx,bx+50],[bz,bz],color='#293a42',linewidth=3,zorder=20)
    for s in [0,25,50]:
        ax.plot([bx+s,bx+s],[bz-1,bz+1],color='#293a42',zorder=20)
    ax.text(bx+25,bz+3,'50m',ha='center',fontsize=8,zorder=20)
    ax.annotate('+Z / N',xy=(x1-12,z1-10),xytext=(x1-12,z1-32),ha='center',
                arrowprops=dict(arrowstyle='->',color='#293a42'),fontsize=9,zorder=20)
    fig.subplots_adjust(bottom=.15,top=.90,left=.09,right=.96)
    for suffix in ['svg','png']:
        fig.savefig(BASE/f'{name}.{suffix}',dpi=180,facecolor=fig.get_facecolor())
    plt.close(fig)

if __name__=='__main__':
    data=json.loads((BASE/'layout.json').read_text())
    draw(data,'top-view')
    draw(data,'pedestrian-network',network=True)
    draw(data,'campus-detail',campus_only=True)
    files=['layout.json','asset_measurements.json','campus-footprint-evidence.json','render_plan.py']
    outputs=[f'{name}.{suffix}' for name in ['top-view','pedestrian-network','campus-detail'] for suffix in ['svg','png']]
    def hashes(names):
        return {name:hashlib.sha256((BASE/name).read_bytes()).hexdigest() for name in names}
    (BASE/'render-manifest.json').write_text(json.dumps({'scope':'Design diagrams only; not Unity captures','source_sha256':hashes(files),'output_sha256':hashes(outputs)},indent=2)+'\n')
    print('Rendered top-view, pedestrian-network, campus-detail as SVG + PNG.')
