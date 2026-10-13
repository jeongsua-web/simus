"""Register rendered combinations; preserves existing manifest rows and statuses."""
from pathlib import Path
import csv
import hashlib
import io
ROOT = Path(__file__).resolve().parents[2]
manifest = ROOT / 'assets/manifest.csv'
rows = list(csv.DictReader(manifest.open()))
fields = list(rows[0])
source = 'unity/Assets/SIMUS/Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Happiness_Animations.blend'
source_hash = hashlib.sha256((ROOT / source).read_bytes()).hexdigest()
for index in range(1, 17):
    for glasses in ('none', 'square', 'round'):
        key = f'citizen_custom_portrait_npc_{index:02d}_{glasses}'
        file = f'web/public/characters/custom/npc_{index:02d}_{glasses}.png'
        row = dict.fromkeys(fields, '')
        row.update(asset_key=key, category='ui', status='received', source_file=source,
                   exchange_file=file, source_sha256=source_hash,
                   exchange_sha256=hashlib.sha256((ROOT / file).read_bytes()).hexdigest(),
                   notes=f'기존 모듈 정면 조합; npc_{index:02d}; glasses {glasses}; 384x480; 전시 승인 별도')
        rows = [r for r in rows if r['asset_key'] != key]
        rows.append(row)
output = io.StringIO()
writer = csv.DictWriter(output, fieldnames=fields, lineterminator='\n')
writer.writeheader()
writer.writerows(rows)
manifest.write_text(output.getvalue())
