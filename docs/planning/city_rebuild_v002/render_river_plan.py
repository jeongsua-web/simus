"""Render the river proposal in v002 world coordinates, without touching Unity."""
import json
import math
import os
from pathlib import Path

os.environ.setdefault('MPLCONFIGDIR', '/tmp/simus-river-mpl')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Circle
import numpy as np
from render_plan import strip, footprint

BASE = Path(__file__).resolve().parent


def curve(points, step):
    controls = np.array(points, dtype=float)
    result = []
    for i in range(len(controls) - 1):
        a, b, c, d = controls[max(i-1, 0)], controls[i], controls[i+1], controls[min(i+2, len(controls)-1)]
        count = max(2, math.ceil(np.linalg.norm(c-b) / step))
        for j in range(count):
            t = j / count
            result.append(.5 * (2*b + (-a+c)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t*t*t))
    result.append(controls[-1])
    return np.array(result)


def main():
    layout = json.loads((BASE / 'layout.json').read_text())
    river = json.loads((BASE / 'river-design.json').read_text())
    line = curve(river['control_points'], river['sample_step_m'])
    fig = plt.figure(figsize=(14, 12), facecolor='#f6f5ef')
    grid = fig.add_gridspec(2, 2, width_ratios=[1.55, 1], height_ratios=[1.25, 1], hspace=.25, wspace=.15)
    ax = fig.add_subplot(grid[:, 0])
    ax.set_facecolor('#eeeae0')
    ax.add_patch(Polygon(layout['park']['polygon'], facecolor='#d5e0bd', edgecolor='#8eaa80'))
    for road in layout['roads']:
        strip(ax, road['points'], road['carriageway_width'] + road['sidewalk_left'] + road['sidewalk_right'], '#b8b2a7', 2)
        strip(ax, road['points'], road['carriageway_width'], '#788183', 3)
    for building in layout['buildings']:
        ax.add_patch(Polygon(footprint(building), facecolor='#c4b096', edgecolor='#8a7963', linewidth=.5, zorder=4))
    for edge in layout['pedestrian_edges']:
        strip(ax, edge['points'], edge['width'], '#ddd4bc', 4)
    # Each band is drawn at its true world-space width, not a screen-space stroke.
    for width, color in [(24, '#a4b77b'), (22.4, '#d2c7a9'), (17.6, '#aabb7f'), (13, '#a19371'), (10, '#4c9297')]:
        strip(ax, line.tolist(), width, color, 5)
    for module in layout['park']['reuse_modules']:
        ax.add_patch(Polygon(footprint(module), facecolor='#ded9c1', edgecolor='#776d54', zorder=8))
        ax.text(module['x'], module['z'], module['id'], ha='center', va='center', fontsize=9, zorder=9)
    for bridge in river['bridges']:
        strip(ax, bridge['endpoints'], 3, '#987354', 10)
        mid = np.mean(bridge['endpoints'], axis=0)
        label = '북측 보행교' if bridge['id'].endswith('NORTH') else '남측 보행교'
        ax.annotate(label, xy=mid, xytext=(175, mid[1]+12), fontsize=10,
                    arrowprops={'arrowstyle': '-', 'color': '#574e41'}, ha='center', zorder=11)
    ax.text(120, 167, '상류 수원', ha='center', fontsize=9, color='#325e60')
    ax.text(137, -29, '하류 완충 수역', ha='center', fontsize=9, color='#325e60')
    ax.set(xlim=(65, 193), ylim=(-45, 185), xlabel='Unity X (m)', ylabel='Unity Z (m)')
    ax.set_aspect('equal')
    ax.grid(alpha=.15)
    ax.set_title('동쪽 공원 하천 배치 / 기존 건물·도로 유지', fontsize=13, pad=14)

    section = fig.add_subplot(grid[0, 1])
    profile = river['half_profile_offset_y']
    full = [(-x, y) for x, y in reversed(profile[1:])] + [(x, y) for x, y in profile]
    xs, ys = zip(*full)
    section.fill_between(xs, ys, -2.6, color='#b4a283')
    section.plot(xs, ys, color='#77684e', linewidth=2)
    section.fill_between([-5, -3, 3, 5], [-1.2, -2, -2, -1.2], -1.2, color='#75b1b8')
    section.plot([-5, 5], [-1.2, -1.2], color='#326e77', linewidth=2)
    for sign in [-1, 1]:
        section.plot([sign*8.8, sign*11.2], [-.43, -.43], color='#e1d5b1', linewidth=6, solid_capstyle='butt')
    section.annotate('수면 폭 10m', xy=(0, -1.2), xytext=(0, -.15), ha='center', arrowprops={'arrowstyle': '->'})
    section.text(0, -2.28, '하상 Y -2.00m', ha='center')
    section.text(-10, .16, '산책로\n2.4m', ha='center', fontsize=9)
    section.text(10, .16, '산책로\n2.4m', ha='center', fontsize=9)
    section.set(xlim=(-14, 14), ylim=(-2.6, .7), xlabel='하천 중심으로부터 거리 (m)', ylabel='Unity Y (m)')
    section.set_title('실제 절개 단면 / 높이는 가독성을 위해 확대', fontsize=11)
    section.grid(alpha=.15)

    notes = fig.add_subplot(grid[1, 1])
    notes.axis('off')
    notes.text(0, 1, 'PHASE 4 · 하천 포함 설계', fontsize=15, fontweight='bold', va='top')
    notes.text(0, .86, '\n'.join([
        '중심선 길이 약 171m / 완만한 곡선',
        '수면 10m · 둔치 포함 전체 24m',
        '하상 -2.00m / 수면 -1.20m',
        '둔치 -0.45m / 산책로 기본 -0.43m',
        '교차부는 +0.14m로 완만하게 연결',
        '',
        '설계상 최소 이격',
        '도로·보도 21.38m / 건물 22.76m',
        '공원 경계 2.20m / PM1 0.48m',
        '',
        '물·하상은 NPC 보행 영역에서 제외',
        '기존 보행로와 교량 2개·경사로로 연결',
        '오염도 0–100 → 수면 색·매끄러움',
        '',
        '이 그림은 설계도이며 Unity 실행 캡처가 아님',
        '기존 layout 및 전시 map_version 변경 없음',
    ]), fontsize=10, linespacing=1.65, va='top', color='#39453c')
    fig.suptitle('CityRebuild_v002 · 동쪽 공원 하천', fontsize=19, y=.98)
    fig.savefig(BASE / 'river-design.png', dpi=170, bbox_inches='tight')
    fig.savefig(BASE / 'river-design.svg', bbox_inches='tight')
    plt.close(fig)


if __name__ == '__main__':
    main()
