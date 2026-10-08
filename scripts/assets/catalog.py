#!/usr/bin/env python3
"""Build/check the asset inventory without moving files or changing approval states."""
import argparse
import csv
import hashlib
import json
import os
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'assets/catalog/inventory.json'
SKIP = {'Library', 'Temp', 'Obj', 'Logs', 'UserSettings', 'Builds', 'node_modules', '.git', '__pycache__'}
ROOTS = ('assets/library', 'assets/incoming', 'assets/archive', 'unity/Assets', 'web/public')


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def inventory():
    records = []
    for folder in ROOTS:
        for current, dirs, files in os.walk(ROOT / folder):
            dirs[:] = sorted(d for d in dirs if d not in SKIP and not d.startswith('.'))
            for name in sorted(files):
                if name.startswith('.'):
                    continue
                path = Path(current) / name
                relative = path.relative_to(ROOT).as_posix()
                suffix = path.suffix.lower()
                role = {'.blend': 'source', '.fbx': 'export', '.glb': 'export',
                        '.meta': 'unity_metadata', '.unity': 'scene', '.prefab': 'prefab',
                        '.mat': 'material', '.controller': 'animation_controller',
                        '.blend1': 'backup', '.blend2': 'backup', '.zip': 'package',
                        '.cs': 'code', '.shader': 'code'}.get(suffix, 'support')
                if suffix in {'.png', '.jpg', '.jpeg', '.svg', '.webp'}:
                    role = 'image'  # Do not infer preview versus runtime texture by extension.
                location = ('archive' if relative.startswith('assets/archive/') else
                            'unity_existing' if relative.startswith('unity/Assets/') else
                            'web_runtime' if relative.startswith('web/public/') else
                            'incoming' if relative.startswith('assets/incoming/') else 'library')
                records.append({'path': relative, 'role': role, 'location': location,
                                'bytes': path.stat().st_size, 'sha256': sha256(path)})
    records.sort(key=lambda r: r['path'])
    groups = defaultdict(list)
    for record in records:
        if record['role'] not in {'unity_metadata', 'support', 'code'}:
            groups[record['sha256']].append(record['path'])
    duplicates = [{'sha256': digest, 'paths': paths} for digest, paths in sorted(groups.items()) if len(paths) > 1]
    return {'schema_version': 1, 'roots': list(ROOTS), 'files': records, 'identical_content_groups': duplicates}


def validate_manifest():
    errors = []
    with (ROOT / 'assets/manifest.csv').open(newline='', encoding='utf-8') as stream:
        rows = list(csv.DictReader(stream))
    keys = set()
    for row in rows:
        key = row['asset_key']
        if not key or key in keys:
            errors.append(f'duplicate/empty asset_key: {key}')
        keys.add(key)
        if row['status'] not in {'planned', 'received', 'approved'}:
            errors.append(f'{key}: invalid status')
        if row['status'] != 'planned' and not (row['source_file'] or row['exchange_file']):
            errors.append(f'{key}: received/approved needs a registered file')
        for field in ('source', 'exchange'):
            value, digest = row[f'{field}_file'], row[f'{field}_sha256']
            if not value:
                if digest:
                    errors.append(f'{key}: hash without path')
                continue
            path = ROOT / value
            if Path(value).is_absolute() or '..' in Path(value).parts or not path.is_file():
                errors.append(f'{key}: invalid or missing path {value}')
            elif sha256(path) != digest:
                errors.append(f'{key}: hash mismatch {value}')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='check inventory freshness and manifest, without writing')
    args = parser.parse_args()
    errors = validate_manifest()
    result = inventory()
    content = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding='utf-8') != content:
            errors.append('inventory is stale; run python3 scripts/assets/catalog.py')
    elif not errors:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(content, encoding='utf-8')
    for error in errors:
        print('ERROR:', error)
    print(f"{len(result['files'])} files; {len(result['identical_content_groups'])} identical-content groups; {len(errors)} errors")
    raise SystemExit(bool(errors))


if __name__ == '__main__':
    main()
