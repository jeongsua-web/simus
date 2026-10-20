#!/usr/bin/env python3
"""Explicit, seed-free PostgreSQL migration entry point. Requires psql 14+."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
# 012 is separately approved content; original 014 is NEVER executed.
ORDER = ['001', '002', '003', '004', '005', '006', '007', '008', '009',
         '010', '011', '013', '016', '015', '017']
LOCK_KEY = 73649812541002


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def sources():
    result = {}
    locked = json.loads((ROOT / 'db' / 'migration-checksums.json').read_text())
    for path in sorted((ROOT / 'db').glob('[0-9][0-9][0-9]_*.sql')):
        version = path.name[:3]
        if version in result:
            raise ValueError(f'Duplicate migration version: {version}')
        raw = path.read_bytes()
        result[version] = (path.name, hashlib.sha256(raw).hexdigest(), raw.decode('utf-8'))
        if locked.get(path.name) != result[version][1]:
            raise ValueError(f'Source checksum differs from reviewed manifest: {path.name}')
    if set(result) != set(ORDER) | {'012', '014'}:
        raise ValueError('Migration inventory changed: review the explicit plan first')
    if set(locked) != {i[0] for i in result.values()}:
        raise ValueError('Checksum manifest inventory mismatch')
    return result


def body(source, version):
    # Only our known legacy outer wrapper is removed. Never rewrite files.
    lines = source.splitlines()
    if version != '016':
        statements = [line.strip() for line in lines if line.strip() and not line.lstrip().startswith('--')]
        if statements[0] != 'BEGIN;' or statements[-1] != 'COMMIT;':
            raise ValueError(f'Unexpected outer transaction wrapper: {version}')
        if sum(line.strip() == 'BEGIN;' for line in lines) != 1 or sum(
                line.strip() == 'COMMIT;' for line in lines) != 1:
            raise ValueError(f'Unexpected transaction wrapper: {version}')
        lines = [line for line in lines if line.strip() not in ('BEGIN;', 'COMMIT;')]
    if any(line.lstrip().startswith('\\') or re.match(r'^\s*(COMMIT|ROLLBACK|START\s+TRANSACTION|BEGIN\s*;)', line, re.I)
           for line in lines):
        raise ValueError(f'Unexpected transaction control or psql command: {version}')
    return '\n'.join(lines)


def assertion(condition, message):
    return f'DO $guard$ BEGIN IF ({condition}) IS NOT TRUE THEN RAISE EXCEPTION {literal(message)}; END IF; END $guard$;\n'


def insert(version, item, origin, evidence):
    name, digest, _ = item
    return ('INSERT INTO simus_migrations.history(version, filename, sha256, origin, evidence) VALUES ('
            + ','.join(map(literal, (version, name, digest, origin, evidence))) + ');\n')


def baseline_entries(path, data, database):
    document = json.loads(Path(path).read_text())
    if set(document) != {'database', 'evidence', 'applied'} or document['database'] != database:
        raise ValueError('Baseline requires matching database, evidence and applied fields')
    evidence = document['evidence']
    if not isinstance(evidence, str) or not evidence.strip():
        raise ValueError('Baseline requires independent deployment evidence; schema inference is forbidden')
    entries = document['applied']
    if not isinstance(entries, dict) or not entries or set(entries) - (set(data) - {'016', '017'}):
        raise ValueError('Baseline applied must list known legacy versions only')
    normal = [v for v in ORDER if v not in {'016', '017'}]
    selected = [v for v in normal if v in entries]
    if selected != normal[:len(selected)] or '001' not in entries:
        raise ValueError('Baseline must be a contiguous legacy schema prefix (012/014 are explicit exceptions)')
    if '010' not in entries:
        raise ValueError('Automatic legacy upgrade requires at least 010; earlier DBs need a separately reviewed additive plan (004 contains prototype NPC coordinates)')
    if '012' in entries and '011' not in entries or '014' in entries and '013' not in entries:
        raise ValueError('Baseline exceptions have missing prerequisites')
    for version, digest in entries.items():
        if digest != data[version][1]:
            raise ValueError(f'Baseline checksum mismatch: {version}')
    return entries, evidence


def plan(args, data):
    sql = ["\\set ON_ERROR_STOP on\nBEGIN;\nSET LOCAL standard_conforming_strings=on;\n"
           "SET LOCAL search_path=pg_catalog,public;\nSET LOCAL lock_timeout='5s';\n"
           "SET LOCAL statement_timeout='120s';\n",
           assertion(f'pg_try_advisory_xact_lock({LOCK_KEY})', 'Another managed migration is running')]
    exists = "to_regnamespace('simus') IS NOT NULL"
    history = "to_regclass('simus_migrations.history') IS NOT NULL"
    if args.command == 'init':
        sql += [assertion(f'NOT ({exists}) AND NOT ({history})', 'init requires an empty SIMUS database')]
    elif args.command == 'baseline':
        sql += [assertion(f'({exists}) AND NOT ({history})', 'baseline requires a legacy DB without managed history')]
    else:
        sql += [assertion(history, 'No managed history: review and explicitly baseline this DB first')]
    if args.command in ('init', 'baseline'):
        sql += ["CREATE SCHEMA simus_migrations;\nREVOKE ALL ON SCHEMA simus_migrations FROM PUBLIC;\n"
                "CREATE TABLE simus_migrations.history (version text PRIMARY KEY, filename text NOT NULL, "
                "sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'), "
                "origin text NOT NULL CHECK(origin IN ('executed','baseline')), evidence text NOT NULL, "
                "applied_at timestamptz NOT NULL DEFAULT clock_timestamp(), "
                "applied_by text NOT NULL DEFAULT session_user);\n"
                "REVOKE ALL ON simus_migrations.history FROM PUBLIC;\n"
                "CREATE FUNCTION simus_migrations.reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ "
                "BEGIN RAISE EXCEPTION 'Migration history is append only'; END $$;\n"
                "CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON simus_migrations.history "
                "FOR EACH ROW EXECUTE FUNCTION simus_migrations.reject_history_mutation();\n"
                "CREATE TRIGGER no_history_truncate BEFORE TRUNCATE ON simus_migrations.history "
                "FOR EACH STATEMENT EXECUTE FUNCTION simus_migrations.reject_history_mutation();\n"]
    # Reject unknown or modified historical source before executing any migration.
    expected = ','.join('(' + ','.join(map(literal, (v, i[0], i[1]))) + ')' for v, i in data.items())
    sql += [assertion('NOT EXISTS (SELECT 1 FROM simus_migrations.history h LEFT JOIN (VALUES '
                     + expected + ') AS e(version,filename,sha256) USING(version) '
                     'WHERE e.version IS NULL OR h.filename<>e.filename OR h.sha256<>e.sha256)',
                     'Migration history checksum/source mismatch')]
    if args.command not in ('init', 'baseline'):
        sql += [assertion("NOT EXISTS (SELECT 1 FROM (VALUES ('001'),('002'),('003'),('004'),('005'),('006'),('007'),('008'),('009'),('010')) AS required(version) LEFT JOIN simus_migrations.history h USING(version) WHERE h.version IS NULL)",
                          'Missing legacy prerequisites; automatic replay is prohibited')]
        sql += [assertion("NOT EXISTS (SELECT 1 FROM simus_migrations.history WHERE version IN ('013','014','015','016')) OR EXISTS (SELECT 1 FROM simus_migrations.history WHERE version='011')",
                          'Inconsistent migration prerequisites')]
        sql += [assertion("NOT EXISTS (SELECT 1 FROM simus_migrations.history WHERE version IN ('014','015','016')) OR EXISTS (SELECT 1 FROM simus_migrations.history WHERE version='013')",
                          'Missing character migration prerequisite')]
    if args.command == 'baseline':
        entries, evidence = baseline_entries(args.baseline_file, data, args.database)
        # A marker mismatch is rejected; marker presence alone never certifies history.
        checks = {'011': "to_regclass('simus.npc_events') IS NOT NULL",
                  '013': "EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='simus' AND table_name='participant_sessions' AND column_name='character_id')",
                  '014': "EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='simus' AND table_name='participant_sessions' AND column_name='glasses_id')",
                  '015': "EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='simus' AND table_name='npc_event_states' AND column_name='guidance_motion')"}
        for v, check in checks.items():
            sql += [assertion(check if v in entries else f'NOT ({check})', f'Baseline schema marker disagrees: {v}')]
        # Fail closed on common drift. This is deliberately not a proof that old
        # SQL ran: historical checksums still require independent attestation.
        for table in ('simulation_sessions', 'participant_sessions', 'choice_records',
                      'session_results', 'participant_results', 'session_creation_requests',
                      'departments', 'push_subscriptions', 'push_jobs', 'result_links'):
            sql += [assertion(f"to_regclass('simus.{table}') IS NOT NULL", f'Missing baseline table: {table}')]
        for column in ('npc_id', 'npc_motion', 'department_id', 'nickname', 'mbti', 'profile_completed_at'):
            sql += [assertion("EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='simus' AND table_name='participant_sessions' AND column_name=" + literal(column) + ')',
                              f'Missing baseline membership column: {column}')]
        for trigger in ('lifecycle_write', 'npc_identity', 'npc_motion_snapshot', 'department_change', 'profile_change'):
            sql += [assertion("EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='simus.participant_sessions'::regclass AND tgenabled='O' AND tgname=" + literal(trigger) + ')',
                              f'Missing or disabled membership guard: {trigger}')]
        sql += [assertion("EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='simus.participant_sessions'::regclass AND attname='npc_motion' AND NOT atthasdef AND NOT attisdropped)",
                          'Legacy NPC default must already have been removed by 010')]
        for table, constraint in (('session_choices','session_choices_alignment_range_check'),
                                  ('choice_records','choice_records_alignment_range_check'),
                                  ('participant_sessions','profile_all_or_nothing')):
            sql += [assertion("EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=" + literal('simus.' + table)
                              + '::regclass AND convalidated AND conname=' + literal(constraint) + ')',
                              f'Missing baseline constraint: {constraint}')]
        sql += [assertion("EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='simus.simulation_sessions'::regclass AND tgname='session_lifecycle' AND tgenabled='O' AND tgfoid='simus.guard_session_lifecycle()'::regprocedure)",
                          'Missing baseline lifecycle guard')]
        for v in sorted(entries):
            sql += [insert(v, data[v], 'baseline', evidence)]
    else:
        versions = ['012'] if args.command == 'approve-running-content' else ORDER
        if args.command == 'approve-running-content':
            sql += [assertion("EXISTS (SELECT 1 FROM simus_migrations.history WHERE version='011')",
                              '012 requires managed 011 history')]
            sql += ['LOCK TABLE simus.simulation_sessions IN ACCESS EXCLUSIVE MODE;\n',
                    'LOCK TABLE simus.session_situations, simus.session_choices IN ACCESS EXCLUSIVE MODE;\n']
            for table in ('session_situations', 'session_choices'):
                sql += [assertion("EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=" + literal('simus.' + table)
                                  + "::regclass AND tgname='draft_content' AND tgenabled='O' AND tgfoid='simus.guard_content()'::regprocedure)",
                                  f'Unexpected content guard on {table}')]
        for v in versions:
            sql += [f"SELECT NOT EXISTS (SELECT 1 FROM simus_migrations.history WHERE version={literal(v)}) AS apply_step \\gset\n",
                    '\\if :apply_step\n', body(data[v][2], v), '\n',
                    insert(v, data[v], 'executed', args.approval_reference or 'managed schema migration'),
                    '\\endif\n']
    sql += ['COMMIT;\n']
    return ''.join(sql)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['init', 'baseline', 'upgrade', 'approve-running-content'])
    parser.add_argument('--host', required=True)
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('--database', required=True)
    parser.add_argument('--user', required=True)
    parser.add_argument('--baseline-file')
    parser.add_argument('--attest-baseline', action='store_true', help='Attest independent historical evidence was reviewed')
    parser.add_argument('--approval-reference', help='Separate approval record authorizing 012 RUNNING content changes')
    args = parser.parse_args()
    # Connection strings can override host/database; allow plain identifiers only.
    for value in (args.database, args.user):
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]*', value):
            parser.error('database/user must be plain identifiers, not connection strings')
    if not 1 <= args.port <= 65535 or not args.host or args.host.startswith('-'):
        parser.error('Explicit host and valid port required')
    if args.command == 'baseline' and (not args.baseline_file or not args.attest_baseline):
        parser.error('baseline requires --baseline-file and --attest-baseline')
    if args.command == 'approve-running-content' and not (args.approval_reference or '').strip():
        parser.error('012 requires a separate nonempty --approval-reference')
    sql = plan(args, sources())
    # No .env loading. Disable service/URL fallbacks and inherited psql options.
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    for key in ('PGPASSFILE', 'PGPASSWORD', 'PGSSLMODE', 'PGSSLROOTCERT', 'PGSSLCERT', 'PGSSLKEY'):
        if key in os.environ:
            env[key] = os.environ[key]
    result = subprocess.run(['psql', '-X', '--no-password', '--host', args.host,
                             '--port', str(args.port), '--dbname', args.database,
                             '--username', args.user, '--set', 'ON_ERROR_STOP=1'],
                            input=sql, text=True, env=env, check=False)
    if result.returncode:
        raise SystemExit('Migration command failed. SQL errors before COMMIT roll back the whole batch; connection loss during COMMIT can leave the outcome unknown. Verify managed history through an approved connection before retrying; never retry raw SQL.')
    print('Managed transaction committed. 012 runs only with its separate approval command.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
