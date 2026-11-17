#!/usr/bin/env python3
"""Create a disposable v003 validation project with its actual asset dependencies."""
import argparse
import pathlib
import re
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
UNITY = ROOT / 'unity'
SCENE = 'Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_EventPlaces.unity'
CHARACTER = 'Assets/SIMUS/Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Happiness_Animations.fbx'
CONTROLLER = 'Assets/SIMUS/Scenes/npc_follow_test/TestNpcWalk.controller'
TEXT_ASSETS = {'.cs', '.unity', '.mat', '.asset', '.shader', '.controller', '.prefab', '.asmdef'}


def copy_file(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    # APFS clones avoid duplicate storage while keeping importer writes isolated.
    result = subprocess.run(['cp', '-c', str(source), str(destination)], capture_output=True)
    if result.returncode:
        shutil.copy2(source, destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=pathlib.Path, default=pathlib.Path('/tmp/simus_v003_validation'))
    args = parser.parse_args()
    destination = args.output.resolve()
    if destination == UNITY.resolve() or destination.is_relative_to(UNITY.resolve()):
        raise SystemExit('Choose a disposable directory outside the source Unity project.')
    index = {}
    for meta in (UNITY / 'Assets').rglob('*.meta'):
        match = re.search(r'^guid: (\w+)', meta.read_text(errors='ignore'), re.M)
        if match:
            index[match[1]] = pathlib.Path(str(meta)[:-5])
    queue = [UNITY / SCENE, UNITY / CHARACTER, UNITY / CONTROLLER, UNITY / 'Assets/Editor/CityMasterplanV003LocalBuild.cs']
    for folder in ['Assets/Scripts', 'Assets/SIMUS/Runtime', 'Assets/Plugins/WebGL', 'Assets/WebGLTemplates']:
        queue.extend(path for path in (UNITY / folder).rglob('*') if path.is_file())
    seen = set()
    while queue:
        source = queue.pop()
        if source in seen or not source.is_file():
            continue
        seen.add(source)
        if source.suffix in TEXT_ASSETS:
            for guid in re.findall(r'guid: ([0-9a-f]{32})', source.read_text(errors='ignore')):
                if guid in index:
                    queue.append(index[guid])
    for source in seen:
        if source.suffix in {'.fbx', '.blend', '.glb'}:
            with source.open('rb') as stream:
                if stream.read(80).startswith(b'version https://git-lfs.github.com/spec/v1'):
                    raise SystemExit(f'Restore Git LFS asset before importing: {source.relative_to(ROOT)}')
        target = destination / source.relative_to(UNITY)
        copy_file(source, target)
        meta = pathlib.Path(str(source) + '.meta')
        if meta.exists():
            copy_file(meta, pathlib.Path(str(target) + '.meta'))
    for folder in ['Packages', 'ProjectSettings']:
        for source in (UNITY / folder).rglob('*'):
            if source.is_file():
                copy_file(source, destination / source.relative_to(UNITY))
    print(f'Prepared {destination} with {len(seen)} dependency files.')
    print('Source scene and source Build Settings are preserved.')


if __name__ == '__main__':
    main()
