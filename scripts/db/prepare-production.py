#!/usr/bin/env python3
"""Prepare seed-free first-install SQL offline; never connect to PostgreSQL."""
import argparse
import hashlib
import importlib.util
from pathlib import Path
from types import SimpleNamespace


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    source = Path(__file__).with_name('migrate.py')
    spec = importlib.util.spec_from_file_location('simus_migrate', source)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)  # Import only; migrate.main()/psql are never called.
    expected = ['001', '002', '003', '004', '005', '006', '007', '008', '009',
                '010', '011', '013', '016', '015']
    if migration.ORDER != expected:
        raise ValueError('Reviewed first-install order changed; review before preparing SQL')
    sql = migration.plan(SimpleNamespace(command='init', approval_reference=None),
                         migration.sources())
    if not sql.endswith('COMMIT;\n'):
        raise ValueError('Unexpected managed transaction ending')
    # Extend the same transaction; no schema ownership or migration-history access
    # is granted to the application. The secret is read only inside PostgreSQL's
    # init container, never placed in this generated artifact or command arguments.
    grants = r"""
\getenv app_password SIMUS_DB_PASSWORD
SET LOCAL password_encryption = 'scram-sha-256';
SELECT format('CREATE ROLE simus_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L', :'app_password') \gexec
REVOKE ALL ON DATABASE simus FROM PUBLIC;
GRANT CONNECT ON DATABASE simus TO simus_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA simus TO simus_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA simus TO simus_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA simus TO simus_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA simus TO simus_app;
-- Future migrations must explicitly review/grant new application objects.
COMMIT;
"""
    sql = sql[:-len('COMMIT;\n')] + grants
    content = sql.encode('utf-8')
    output = args.output_dir
    output.mkdir(parents=True, exist_ok=True)
    sql_path = output / 'init.sql'
    checksum_path = output / 'init.sql.sha256'
    # Refuse overwriting an artifact that might already be reviewed or mounted.
    if sql_path.exists() or checksum_path.exists():
        raise ValueError('Output exists; select a new directory and review it explicitly')
    with sql_path.open('xb') as stream:
        stream.write(content)
    checksum_path.write_text(hashlib.sha256(content).hexdigest() + '  init.sql\n')
    # Entry point runs init scripts as the container postgres UID. These files
    # contain no secrets and must remain readable despite host umask 077.
    output.chmod(0o755)
    sql_path.chmod(0o644)
    checksum_path.chmod(0o644)
    print(f'Prepared {sql_path}; no DB connection, psql, container, or seed execution.')


if __name__ == '__main__':
    main()
