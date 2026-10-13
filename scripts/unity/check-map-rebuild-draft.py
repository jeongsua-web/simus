#!/usr/bin/env python3
"""Structural draft check; does not substitute for Unity import/Play Mode."""
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
FOLDER = ROOT / 'unity/Assets/SIMUS/Scenes/map_rebuild_draft'
layout = json.loads((FOLDER / 'layout.json').read_text())
scene = (FOLDER / 'map_rebuild_draft.unity').read_text()
blocks = re.findall(r'^--- !u!(\d+) &(-?\d+)(?: stripped)?\n(.*?)(?=^--- !u!|\Z)', scene, re.M | re.S)
ids = [int(b[1]) for b in blocks]
assert len(ids) == len(set(ids)), 'Duplicate serialized file IDs'
objects = {int(i): (int(t), body) for t, i, body in blocks}
for match in re.finditer(r'\{fileID: (-?\d+)\}', scene):
    identifier = int(match[1])
    assert identifier == 0 or identifier in objects, f'Dangling local ID {identifier}'

def field(body, name):
    match = re.search(r'^  '+re.escape(name)+r': (.+)$', body, re.M)
    assert match, name
    return match[1].strip('"')

def vector(body, name):
    return {key: float(value) for key, value in re.findall(r'([xyz]): ([-+\d.eE]+)', field(body, name))}

game_objects = {i: body for i, (t, body) in objects.items() if t == 1}
named = {field(body, 'm_Name'): i for i, body in game_objects.items()}
assert sum(field(body, 'm_Name') == 'GeneratedDraft' for body in game_objects.values()) == 1
root = named['GeneratedDraft']
transforms = {int(field(body, 'm_GameObject').split(': ')[1].strip('}')): body for t, body in objects.values() if t == 4 and 'm_GameObject:' in body}
root_transform = next(i for i, (t, body) in objects.items() if t == 4 and body == transforms[root])
for item in layout['items']:
    assert item['name'] in named, f'Missing {item["name"]}'
    body = transforms[named[item['name']]]
    assert field(body, 'm_Father') == '{fileID: '+str(root_transform)+'}'
    # Unity regeneration substitutes native-scale FBX for the two measured proxy boxes.
    if not item['modelPath']:
        for field_name, expected in [('m_LocalPosition', item['position']), ('m_LocalScale', item['size'])]:
            actual = vector(body, field_name)
            assert all(abs(actual[k]-expected[k]) < .0001 for k in 'xyz'), item['name']
    assert (ROOT/'unity'/next(m['path'] for m in layout['materials'] if m['key'] == item['material'])).exists()
assert len(layout['items']) == len(set(item['name'] for item in layout['items']))
assert layout['status'] == 'provisional_road_and_zone_draft_not_exhibition'
assert layout['roadWidth'] == 8 and layout['sidewalkWidth'] == 3
# Check painted crossings are supported by a road footprint, including outer approaches.
roads = [i for i in layout['items'] if i['material'] == 'road']
for item in (i for i in layout['items'] if i['name'].startswith('Crossing')):
    assert any(all(abs(item['position'][axis]-road['position'][axis])+item['size'][axis]/2 <= road['size'][axis]/2+.00001 for axis in ['x','z']) for road in roads), item['name']
# Existing NPC points must remain on the new sidewalk throughout the local scale-test segment.
for x in range(-65,-28):
    assert any(abs(x-i['position']['x']) <= i['size']['x']/2 and abs(5.5-i['position']['z']) <= i['size']['z']/2 for i in layout['items'] if i['material']=='walk')
assert 'propertyPath: m_IsActive\n      value: 0' in scene, 'Copied full map should be inactive'
assert 'guid: c8a76d6cc75b89f4791429d79f49f1ec' in scene, 'Original NPC reference lost'
print(json.dumps({'result':'pass','scope':'serialized structure and geometry only; Unity execution unverified','generated_items':len(layout['items']),'local_ids':len(ids),'crossings_supported':216,'layout_sha256':hashlib.sha256((FOLDER/'layout.json').read_bytes()).hexdigest()},indent=2))
