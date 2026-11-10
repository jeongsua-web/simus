#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
if [[ $# -ne 1 || ! "$1" =~ ^(init|issue)$ ]]; then
  echo 'Usage: bash scripts/auth/run-admin.sh init|issue' >&2
  exit 1
fi
image=$(python3 - <<'PY'
from pathlib import Path
import re
lines = [line.split('=', 1)[1].strip() for line in Path('.env.production').read_text().splitlines()
         if line.startswith('SIMUS_IMAGE=')]
if len(lines) != 1:
    raise SystemExit('Expected one SIMUS_IMAGE in .env.production.')
image = lines[0]
if not re.fullmatch(r'ghcr\.io/[a-z0-9._/-]+(?::sha-[0-9a-f]{40}|@sha256:[0-9a-f]{64})', image):
    raise SystemExit('SIMUS_IMAGE must use a reviewed GHCR full commit SHA or digest.')
print(image)
PY
)
exec sudo docker run --rm --pull never --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$PWD,dst=/ops" -w /ops \
  --entrypoint node "$image" scripts/auth/admin-token.mjs "$1"
