"""Real PostgreSQL integration tests; creates and drops only its own unique test DB."""
import json
import os
import sys
import threading
import time
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from store import Store, Problem
from server import Handler

ADMIN='00000000-0000-0000-0000-000000000001'


class Integration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base=os.environ['SIMUS_TEST_ADMIN_DSN']
        suffix=uuid.uuid4().hex[:12]
        cls.name='simus_test_'+suffix
        cls.role='simus_test_runtime_'+suffix
        with psycopg.connect(cls.base,autocommit=True) as db:
            db.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(cls.name)))
            db.execute(sql.SQL('CREATE ROLE {} LOGIN').format(sql.Identifier(cls.role)))
        cls.owner=make_conninfo(cls.base,dbname=cls.name)
        cls.runtime=make_conninfo(cls.owner,user=cls.role)
        cls.addClassCleanup(cls.cleanup_database)
        with psycopg.connect(cls.owner,autocommit=True) as db:
            for name in ('01_schema.sql','02_demo_seed.sql','03_verify.sql'):
                db.execute((ROOT.parent/'outputs/sql'/name).read_text())
            db.execute((ROOT/'sql/04_runtime.sql').read_text())
            grants=(ROOT/'sql/05_runtime_role.sql').read_text().replace(':"runtime_role"',sql.Identifier(cls.role).as_string(db))
            db.execute(grants)
        cls.store=Store(cls.runtime,ADMIN)

    @classmethod
    def cleanup_database(cls):
        with psycopg.connect(cls.base,autocommit=True) as db:
            db.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(cls.name)))
            db.execute(sql.SQL('DROP ROLE {}').format(sql.Identifier(cls.role)))

    def setUp(self):
        with self.store.tx() as db:
            active=db.execute("SELECT id FROM simulation_sessions WHERE status IN ('RUNNING','CLOSING')").fetchall()
        for row in active:
            self.store.finish(row['id'])

    def round(self,duration=300,scale=0.1):
        r=self.store.start(duration,scale)
        token=self.store.join('',r['id'])
        s=self.store.me(token,r['id'])['situations'][0]
        return r,token,s

    def choose(self,r,t,s,index=0,**kwargs):
        return self.store.choose(t,r['id'],s['id'],s['choices'][index]['id'],uuid.uuid4(),**kwargs)

    def test_ab_atomic_ledger_and_privacy(self):
        r,t,s=self.round()
        t2=self.store.join('',r['id'])
        self.choose(r,t,s)
        self.choose(r,t2,s,1)
        c=self.store.state()['round']
        self.assertEqual((c['happiness'],c['cleanliness'],c['pollution'],c['version']),(Decimal('50.3'),Decimal('50.5'),0,2))
        me=self.store.me(t,r['id'])
        self.assertIsNone(me['result'])
        self.assertNotIn('alignment_dx',str(me))
        self.assertNotIn('happiness_base',str(me))
        with self.store.tx() as db:
            e=db.execute('SELECT delta_requested,delta_applied FROM choice_record_region_effects WHERE session_id=%s',(r['id'],)).fetchone()
            self.assertEqual((e['delta_requested'],e['delta_applied']),(Decimal('-0.5'),0))
        self.store.finish(r['id'])
        self.assertEqual(self.store.me(t,r['id'])['result']['x'],1)
        self.assertEqual(self.store.me(t2,r['id'])['result']['x'],0)

    def test_idempotence_parallel_and_conflicts(self):
        r,t,s=self.round()
        key=uuid.uuid4()
        def submit(_):
            return Store(self.runtime,ADMIN).choose(t,r['id'],s['id'],s['choices'][0]['id'],key)
        with ThreadPoolExecutor(max_workers=8) as pool:
            answers=list(pool.map(submit,range(8)))
        self.assertEqual(sum(not a['replayed'] for a in answers),1)
        self.assertEqual(self.store.state()['round']['version'],1)
        with self.assertRaises(Problem):
            self.store.choose(t,r['id'],s['id'],s['choices'][1]['id'],key)
        with self.assertRaises(Problem):
            self.choose(r,t,s,1)
        self.store.finish(r['id'])
        self.assertTrue(submit(0)['replayed'])

    def test_concurrent_visitors_no_lost_updates(self):
        r,t,s=self.round()
        tokens=[t]+[self.store.join('',r['id']) for _ in range(11)]
        with ThreadPoolExecutor(max_workers=12) as pool:
            list(pool.map(lambda token:self.choose(r,token,s),tokens))
        c=self.store.state()['round']
        self.assertEqual((c['happiness'],c['cleanliness'],c['version']),(Decimal('53.6'),Decimal('56'),12))

    def test_cutoff_exact_and_adjacent(self):
        r,t,s=self.round()
        cutoff=r['cutoff']
        for delta in (0,0.000001):
            with self.assertRaises(Problem):
                self.choose(r,t,s,received=cutoff+timedelta(seconds=delta))
        self.choose(r,t,s,received=cutoff-timedelta(microseconds=1))
        self.assertEqual(self.store.state()['round']['version'],1)

    def test_manual_cancels_inflight_and_recovers_after_restart(self):
        r,t,s=self.round()
        completed=self.store.join('',r['id'])
        self.choose(r,completed,s)
        ready,release=threading.Event(),threading.Event()
        def pause():
            ready.set()
            self.assertTrue(release.wait(4))
        with ThreadPoolExecutor() as pool:
            pending=pool.submit(self.choose,r,t,s,before_commit=pause)
            self.assertTrue(ready.wait(3))
            try:
                self.store.approve_close(r['id'],manual=True)
            finally:
                release.set()
            with self.assertRaises(Problem):
                pending.result(timeout=5)
        recovered=Store(self.runtime,ADMIN)
        recovered.tick()
        c=recovered.state(r['id'])['round']
        self.assertEqual((c['status'],c['mode'],c['version']),('FINALIZED','MANUAL',1))
        self.assertEqual(recovered.me(t,r['id'])['result']['count'],0)
        self.assertIn('참여한 선택 없음',recovered.me(t,r['id'])['result']['interpretation'])
        self.assertEqual(recovered.me(completed,r['id'])['result']['count'],1)
        self.assertEqual(recovered.finish(r['id']),c)

    def test_auto_expiry_rolls_back_and_finalize_race(self):
        r,t,s=self.round(duration=10)
        def expire():
            remaining=(r['ends']-self.store_time()).total_seconds()
            time.sleep(max(0,remaining)+0.02)
        with self.assertRaises(Problem):
            self.choose(r,t,s,before_commit=expire)
        with ThreadPoolExecutor(max_workers=3) as pool:
            list(pool.map(lambda _:self.store.finish(r['id']),range(3)))
        c=self.store.state()['round']
        self.assertEqual((c['mode'],c['version'],c['happiness']),('AUTO',0,50))
        with self.store.tx() as db:
            self.assertEqual(db.execute('SELECT count(*) AS n FROM session_results WHERE session_id=%s',(r['id'],)).fetchone()['n'],1)

    def store_time(self):
        with self.store.tx() as db:
            return self.store.now(db)

    def test_round_isolation_and_credentials(self):
        r,t,s=self.round()
        self.assertEqual(t,self.store.join(t,r['id']))
        self.choose(r,t,s)
        self.store.finish(r['id'])
        old=self.store.me(t,r['id'])['result']
        r2=self.store.start()
        self.assertEqual(self.store.state()['round']['happiness'],50)
        self.store.join(t,r2['id'])
        with self.assertRaises(Problem):
            self.choose(r,t,s)
        s2=self.store.me(t,r2['id'])['situations'][0]
        self.choose(r2,t,s2)
        self.assertEqual(self.store.me(t,r['id'])['result'],old)
        stranger=self.store.join('',r2['id'])
        self.assertFalse(self.store.me(stranger,r['id'])['joined'])
        with self.store.tx() as db:
            pid=self.store._visitor(db,t)
        with psycopg.connect(self.owner) as db:
            db.execute('UPDATE simus.participant_credentials SET revoked_at=clock_timestamp() WHERE participant_id=%s',(pid,))
        with self.assertRaises(Problem):
            self.store.me(t,r2['id'])

    def test_invalid_choice_and_transaction_failure(self):
        r,t,s=self.round()
        with self.assertRaises(Problem):
            self.store.choose(t,r['id'],s['id'],uuid.uuid4(),uuid.uuid4())
        def fail():
            raise RuntimeError('simulated failure before commit')
        with self.assertRaises(RuntimeError):
            self.choose(r,t,s,before_commit=fail)
        self.assertEqual(self.store.state()['round']['version'],0)
        self.assertEqual(self.store.me(t,r['id'])['count'],0)

    def test_precision_content_lock_and_runtime_privileges(self):
        r,t,s=self.round(scale='0.0000000001')
        self.choose(r,t,s)
        self.assertEqual(self.store.state()['round']['happiness'],Decimal('50.0000000003'))
        for statement in (
            'UPDATE simus.session_choices SET label=label WHERE session_id=%s',
            'UPDATE simus.simulation_sessions SET impact_scale=1 WHERE id=%s',
            'DELETE FROM simus.choice_records WHERE session_id=%s',
            'TRUNCATE simus.participants',
        ):
            with self.assertRaises(psycopg.Error):
                with psycopg.connect(self.runtime) as db:
                    db.execute(statement,(r['id'],) if '%s' in statement else None)
        with self.assertRaises(psycopg.Error):
            with psycopg.connect(self.owner) as db:
                db.execute('UPDATE simus.session_choices SET label=label WHERE session_id=%s',(r['id'],))
        self.store.finish(r['id'])
        with self.assertRaises(psycopg.Error):
            with psycopg.connect(self.runtime) as db:
                db.execute('UPDATE simus.city_states SET happiness=0 WHERE session_id=%s',(r['id'],))

    def test_simultaneous_starts_and_inactive_admin(self):
        def start(_):
            try:
                return self.store.start()
            except Problem as e:
                return e.status
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(start,range(2)))
        self.assertEqual(sum(isinstance(r,dict) for r in results),1)
        self.assertIn(409,results)
        with self.assertRaises(Problem) as error:
            Store(self.runtime,uuid.uuid4()).finish(self.store.state()['round']['id'])
        self.assertEqual(error.exception.status,403)

    def test_weighted_pollution_and_clamp(self):
        # Separate synthetic DRAFT fixture, never user content or an operating round.
        rid=uuid.uuid4()
        with psycopg.connect(self.owner) as db:
            db.execute("""INSERT INTO simus.simulation_sessions(id,name,scheduled_end_at,expected_participants,expected_answers_per_person,impact_scale,created_by_admin_id)
                          VALUES(%s,'검증 전용',clock_timestamp()+interval '1 hour',2,1,1,%s)""",(rid,ADMIN))
            a,b,q,c=[uuid.uuid4() for _ in range(4)]
            db.execute("INSERT INTO simus.session_regions(session_id,id,code,name,aggregation_weight) VALUES(%s,%s,'A','A',1),(%s,%s,'B','B',3)",(rid,a,rid,b))
            db.execute("INSERT INTO simus.session_situations(session_id,id,code,title,body) VALUES(%s,%s,'TEST','검증','검증')",(rid,q))
            db.execute("INSERT INTO simus.session_choices(session_id,situation_id,id,label,importance,happiness_base,safety_base,cleanliness_base) VALUES(%s,%s,%s,'검증','MAJOR',10,-10,0)",(rid,q,c))
            db.execute('INSERT INTO simus.choice_region_effects VALUES(%s,%s,%s,%s,10)',(rid,q,c,a))
            db.execute('INSERT INTO simus.city_states(session_id,happiness,safety) VALUES(%s,99,1)',(rid,))
            db.execute('INSERT INTO simus.region_states VALUES(%s,%s,99,clock_timestamp()),(%s,%s,0,clock_timestamp())',(rid,a,rid,b))
            db.execute("UPDATE simus.simulation_sessions SET status='RUNNING',starts_at=clock_timestamp() WHERE id=%s",(rid,))
        t=self.store.join('',rid)
        self.store.choose(t,rid,q,c,uuid.uuid4())
        city=self.store.state(rid)['round']
        self.assertEqual((city['happiness'],city['safety'],city['pollution']),(100,0,25))
        with self.store.tx() as db:
            row=db.execute('SELECT happiness_requested,happiness_applied,safety_applied FROM choice_records WHERE session_id=%s',(rid,)).fetchone()
            self.assertEqual(tuple(row.values()),(10,1,-1))
        self.store.finish(rid)
        self.assertEqual(self.store.state(rid)['round']['pollution'],25)

    def test_http_auth_validation_and_full_flow(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        server.store=self.store
        server.admin_key='test-key'
        server.admin_session='test-admin-session'
        server.public_url='http://127.0.0.1/'
        worker=threading.Thread(target=server.serve_forever,daemon=True)
        worker.start()
        def call(path,body=None,cookie='',method=None):
            conn=HTTPConnection('127.0.0.1',server.server_port,timeout=10)
            conn.request(method or ('POST' if body is not None else 'GET'),path,
                         json.dumps(body) if body is not None else None,
                         {'Content-Type':'application/json','Cookie':cookie})
            response=conn.getresponse()
            raw=response.read()
            result=(response.status,json.loads(raw) if raw else None,response.getheader('Set-Cookie'))
            conn.close()
            return result
        try:
            self.assertEqual(call('/api/admin/start',{})[0],403)
            self.assertEqual(call('/api/admin/login',{'key':'bad'})[0],401)
            status,_,cookie=call('/api/admin/login',{'key':'test-key'})
            self.assertEqual(status,200)
            self.assertIn('HttpOnly',cookie)
            admin=cookie.split(';')[0]
            status,r,_=call('/api/admin/start',{},admin)
            self.assertEqual(status,200)
            rid=r['id']
            _,_,cookie=call('/api/join',{'round':rid})
            visitor=cookie.split(';')[0]
            status,me,_=call('/api/me?round='+rid,cookie=visitor)
            self.assertEqual(status,200)
            self.assertIsNone(me['result'])
            s=me['situations'][0]
            payload=dict(round=rid,situation=s['id'],choice=s['choices'][0]['id'],request=str(uuid.uuid4()))
            self.assertEqual(call('/api/choice',payload,visitor)[0],200)
            self.assertEqual(call('/api/admin/finish',{'round':rid,'confirmed':True},visitor)[0],403)
            self.assertEqual(call('/api/admin/finish',{'round':rid},admin)[0],400)
            self.assertEqual(call('/api/admin/finish',{'round':rid,'confirmed':True},admin)[0],200)
            self.assertEqual(call('/api/me?round='+rid,cookie=visitor)[1]['result']['x'],1)
            self.assertEqual(call('/api/state?round=bad')[0],400)
            self.assertEqual(call('/api/me?round='+rid)[0],401)
            self.assertEqual(call('/api/choice',[])[0],400)
            self.assertEqual(call('/../data/admin-key.txt')[0],404)
        finally:
            server.shutdown()
            server.server_close()
            worker.join()


if __name__=='__main__':
    unittest.main(verbosity=2)
