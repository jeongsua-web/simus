#!/usr/bin/env bash
# Official postgres image sources non-executable *.sh files during first init.
# This script is exclusively for a new PGDATA, never an existing-DB upgrade.
(
set -Eeuo pipefail

if [[ "${POSTGRES_DB:-}" != simus || "${POSTGRES_USER:-}" != postgres ]]; then
  echo 'Production init requires POSTGRES_DB=simus and POSTGRES_USER=postgres.' >&2
  exit 1
fi
if [[ ! "${SIMUS_DB_PASSWORD:-}" =~ ^[a-fA-F0-9]{64}$ ]]; then
  echo 'SIMUS_DB_PASSWORD must be 64 hexadecimal characters (openssl rand -hex 32).' >&2
  exit 1
fi
if [[ -e "${PGDATA:?}/.simus-init-complete" ]]; then
  echo 'Production init marker already exists; manual review required.' >&2
  exit 1
fi
(
  cd /schema-init
  sha256sum --check --strict init.sql.sha256
)
# The generated SQL owns a single transaction for schema, history, app role and
# grants. -1 is deliberately omitted: the generated SQL already wraps BEGIN/COMMIT.
# pg entrypoint's temporary server is socket-only. Never connect to another host.
psql -X --no-password --host /var/run/postgresql --username postgres --dbname simus \
  --set ON_ERROR_STOP=1 --file /schema-init/init.sql
touch "${PGDATA}/.simus-init-complete"
echo 'SIM:US first-install transaction committed; readiness marker created.'
)
