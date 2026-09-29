#!/usr/bin/env python3
"""Single-process LAN prototype; no third-party Python dependencies."""
import argparse
import hashlib
import json
import math
import os
import secrets
import socket
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

from content import SITUATIONS, classify

ROOT = Path(__file__).resolve().parent


class Problem(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


class Store:
    def __init__(self, path, clock=time.time):
        self.path, self.clock = str(path), clock
        self.lock = threading.RLock()
        with self.tx() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS rounds (
              id TEXT PRIMARY KEY, number INTEGER UNIQUE, started REAL, ends REAL,
              status TEXT, ended REAL, mode TEXT, scale REAL, content TEXT,
              happiness INTEGER DEFAULT 50000, safety INTEGER DEFAULT 50000,
              cleanliness INTEGER DEFAULT 50000, pollution TEXT,
              version INTEGER DEFAULT 0, result TEXT);
            CREATE UNIQUE INDEX IF NOT EXISTS one_running ON rounds(status) WHERE status='RUNNING';
            CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY, token TEXT UNIQUE);
            CREATE TABLE IF NOT EXISTS members (
              round TEXT, visitor TEXT, x INTEGER DEFAULT 0, y INTEGER DEFAULT 0,
              count INTEGER DEFAULT 0, result TEXT, PRIMARY KEY(round,visitor),
              FOREIGN KEY(round) REFERENCES rounds(id), FOREIGN KEY(visitor) REFERENCES visitors(id));
            CREATE TABLE IF NOT EXISTS answers (
              round TEXT, visitor TEXT, situation TEXT, choice TEXT, request TEXT,
              received REAL, applied REAL, version INTEGER,
              PRIMARY KEY(round,visitor,situation), UNIQUE(round,visitor,request),
              FOREIGN KEY(round,visitor) REFERENCES members(round,visitor));
            ''')

    @contextmanager
    def tx(self):
        with self.lock:
            db = sqlite3.connect(self.path, timeout=10)
            db.row_factory = sqlite3.Row
            db.execute('PRAGMA foreign_keys=ON')
            try:
                db.execute('BEGIN IMMEDIATE')
                yield db
                db.commit()
            except BaseException:
                db.rollback()
                raise
            finally:
                db.close()

    def _round(self, db, rid=None):
        row = db.execute('SELECT * FROM rounds WHERE id=?', (rid,)).fetchone() if rid else db.execute(
            'SELECT * FROM rounds ORDER BY number DESC LIMIT 1').fetchone()
        if row is None:
            raise Problem(404, '아직 회차가 없어요. 관리자가 회차를 시작해 주세요.')
        return row

    def _visitor(self, db, token):
        row = db.execute('SELECT id FROM visitors WHERE token=?', (token_hash(token),)).fetchone()
        if not row:
            raise Problem(401, '먼저 도시 참여하기를 눌러 주세요.')
        return row['id']

    def _public(self, db, r):
        pollution = json.loads(r['pollution'])
        return dict(id=r['id'], number=r['number'], started=r['started'], ends=r['ends'],
                    status=r['status'], ended=r['ended'], mode=r['mode'], version=r['version'],
                    accepting=r['status']=='RUNNING' and self.clock() < r['ends']-5,
                    happiness=r['happiness']/1000, safety=r['safety']/1000,
                    cleanliness=r['cleanliness']/1000,
                    pollution=sum(pollution.values()) / len(pollution) / 1000,
                    regions={k:v/1000 for k,v in pollution.items()},
                    participants=db.execute('SELECT count(*) FROM members WHERE round=?',(r['id'],)).fetchone()[0],
                    responses=r['version'])

    def _finalize(self, db, r, mode, now):
        if r['status'] != 'RUNNING':
            return
        ended = r['ends'] if mode=='AUTO' else now
        db.execute("UPDATE rounds SET status='FINALIZED',ended=?,mode=? WHERE id=?", (ended,mode,r['id']))
        for m in db.execute('SELECT * FROM members WHERE round=?', (r['id'],)).fetchall():
            result = dict(x=m['x'], y=m['y'], count=m['count'], alignment=classify(m['x'],m['y']))
            db.execute('UPDATE members SET result=? WHERE round=? AND visitor=?',
                       (json.dumps(result,ensure_ascii=False),r['id'],m['visitor']))
        final = self._public(db,self._round(db,r['id']))
        db.execute('UPDATE rounds SET result=? WHERE id=?', (json.dumps(final),r['id']))

    def tick(self):
        with self.tx() as db:
            for r in db.execute("SELECT * FROM rounds WHERE status='RUNNING'").fetchall():
                if self.clock() >= r['ends']:
                    self._finalize(db,r,'AUTO',self.clock())

    def start(self, duration=600, scale=0.1):
        if isinstance(duration,bool) or not isinstance(duration,(int,float)) or not math.isfinite(duration) or not 10 <= duration <= 86400:
            raise Problem(400,'회차 길이는 10초~24시간으로 설정해 주세요.')
        if isinstance(scale,bool) or not isinstance(scale,(int,float)) or not math.isfinite(scale) or not 0 <= scale <= 1:
            raise Problem(400,'보정 계수는 0~1이어야 해요.')
        self.tick()
        with self.tx() as db:
            if db.execute("SELECT 1 FROM rounds WHERE status='RUNNING'").fetchone():
                raise Problem(409,'현재 회차를 먼저 종료해 주세요.')
            rid, now = str(uuid.uuid4()), self.clock()
            number = db.execute('SELECT coalesce(max(number),0)+1 FROM rounds').fetchone()[0]
            db.execute('INSERT INTO rounds(id,number,started,ends,status,scale,content,pollution) VALUES(?,?,?,?,?,?,?,?)',
                       (rid,number,now,now+duration,'RUNNING',scale,json.dumps(SITUATIONS,ensure_ascii=False),
                        json.dumps({s['id']:0 for s in SITUATIONS})))
            return self._public(db,self._round(db,rid))

    def finish(self, rid):
        self.tick()
        with self.tx() as db:
            r=self._round(db,rid)
            self._finalize(db,r,'MANUAL',self.clock())
            return json.loads(self._round(db,rid)['result'])

    def state(self, rid=None):
        self.tick()
        with self.tx() as db:
            r=self._round(db,rid)
            return dict(round=json.loads(r['result']) if r['result'] else self._public(db,r), server_time=self.clock())

    def join(self, token, rid):
        self.tick()
        with self.tx() as db:
            r=self._round(db,rid)
            if r['status']!='RUNNING' or self.clock()>=r['ends']-5:
                raise Problem(409,'이 회차의 참여가 마감됐어요.')
            row=db.execute('SELECT id FROM visitors WHERE token=?',(token_hash(token),)).fetchone() if token else None
            if row:
                visitor=row['id']
            else:
                visitor,token=str(uuid.uuid4()),secrets.token_urlsafe(32)
                db.execute('INSERT INTO visitors VALUES(?,?)',(visitor,token_hash(token)))
            db.execute('INSERT OR IGNORE INTO members(round,visitor) VALUES(?,?)',(rid,visitor))
            return token

    def me(self, token, rid):
        self.tick()
        with self.tx() as db:
            visitor=self._visitor(db,token)
            r=self._round(db,rid)
            m=db.execute('SELECT * FROM members WHERE round=? AND visitor=?',(rid,visitor)).fetchone()
            history=[dict(id=x['id'],number=x['number']) for x in db.execute(
                "SELECT r.id,r.number FROM rounds r JOIN members m ON m.round=r.id WHERE m.visitor=? AND r.status='FINALIZED' ORDER BY number DESC",(visitor,))]
            if not m:
                return dict(joined=False,history=history)
            answers={x['situation']:x['choice'] for x in db.execute('SELECT situation,choice FROM answers WHERE round=? AND visitor=?',(rid,visitor))}
            situations=[dict(id=s['id'],title=s['title'],place=s['place'],body=s['body'],
                             choices=[dict(id=c[0],label=c[1]) for c in s['choices']]) for s in json.loads(r['content'])]
            return dict(joined=True, count=m['count'], answers=answers, situations=situations, history=history,
                        result=json.loads(m['result']) if m['result'] else None)

    def choose(self, token, rid, situation, choice, request, received=None):
        received=self.clock() if received is None else received
        try:
            uuid.UUID(request)
        except (ValueError,TypeError,AttributeError):
            raise Problem(400,'요청 번호가 올바르지 않아요.')
        self.tick()
        with self.tx() as db:
            visitor=self._visitor(db,token)
            r=self._round(db,rid)
            previous=db.execute('SELECT * FROM answers WHERE round=? AND visitor=? AND request=?',(rid,visitor,request)).fetchone()
            if previous:
                if previous['situation']!=situation or previous['choice']!=choice:
                    raise Problem(409,'같은 요청 번호에 다른 선택을 제출할 수 없어요.')
                return dict(ok=True,version=previous['version'],replayed=True)
            if r['status']!='RUNNING' or received>=r['ends']-5 or self.clock()>=r['ends']:
                raise Problem(409,'종료 준비 중이거나 이미 종료되어 선택이 반영되지 않았어요.')
            m=db.execute('SELECT * FROM members WHERE round=? AND visitor=?',(rid,visitor)).fetchone()
            if not m:
                raise Problem(403,'이 회차에 먼저 참여해 주세요.')
            if db.execute('SELECT 1 FROM answers WHERE round=? AND visitor=? AND situation=?',(rid,visitor,situation)).fetchone():
                raise Problem(409,'이미 응답한 상황이에요. 선택은 변경할 수 없어요.')
            s=next((s for s in json.loads(r['content']) if s['id']==situation),None)
            c=next((c for c in s['choices'] if c[0]==choice),None) if s else None
            if not c:
                raise Problem(400,'상황과 선택지가 일치하지 않아요.')
            clamp=lambda v:max(0,min(100000,v))
            delta=lambda value:round(value*r['scale']*1000)
            values=[clamp(r[k]+delta(v)) for k,v in zip(('happiness','safety','cleanliness'),c[4:7])]
            pollution=json.loads(r['pollution'])
            pollution[situation]=clamp(pollution[situation]+delta(c[7]))
            db.execute('UPDATE members SET x=x+?,y=y+?,count=count+1 WHERE round=? AND visitor=?',(c[2],c[3],rid,visitor))
            db.execute('UPDATE rounds SET happiness=?,safety=?,cleanliness=?,pollution=?,version=version+1 WHERE id=?',(*values,json.dumps(pollution),rid))
            db.execute('INSERT INTO answers VALUES(?,?,?,?,?,?,?,?)',(rid,visitor,situation,choice,request,received,self.clock(),r['version']+1))
            # The lock serializes manual approval with commits. Automatic expiry is checked again before commit.
            if self.clock()>=r['ends']:
                raise Problem(409,'종료 시각까지 처리가 완료되지 않아 선택을 취소했어요.')
            return dict(ok=True,version=r['version']+1,replayed=False)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT/'web'),**kwargs)

    def log_message(self, format, *args):
        if args and str(args[0]).startswith('GET /api/'):
            return
        super().log_message(format,*args)

    def cookie(self,name):
        jar=SimpleCookie()
        try: jar.load(self.headers.get('Cookie',''))
        except Exception: return ''
        return jar[name].value if name in jar else ''

    def send_json(self,data,status=200,cookie=None):
        raw=json.dumps(data,ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        if cookie: self.send_header('Set-Cookie',cookie)
        self.send_header('Content-Length',str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        p=urlsplit(self.path)
        if p.path.startswith('/api/'):
            try:
                rid=parse_qs(p.query).get('round',[None])[0]
                if p.path=='/api/state': data=self.server.store.state(rid)
                elif p.path=='/api/me':
                    if not rid: raise Problem(400,'회차가 필요해요.')
                    data=self.server.store.me(self.cookie('simus_visitor'),rid)
                elif p.path=='/api/config':
                    data=dict(join_url=self.server.public_url,admin=self.admin_valid())
                else: raise Problem(404,'없는 주소예요.')
                self.send_json(data)
            except Problem as e: self.send_json(dict(error=e.message),e.status)
            return
        if p.path in ('/','/display','/admin'): self.path='/index.html'
        # Serve only the web directory; runtime data and admin secrets live outside it.
        super().do_GET()

    def admin_valid(self):
        value=self.cookie('simus_admin')
        return bool(value) and secrets.compare_digest(value,self.server.admin_session)

    def do_POST(self):
        received=time.time()
        try:
            origin=self.headers.get('Origin')
            if origin and urlsplit(origin).netloc != self.headers.get('Host'):
                raise Problem(403,'같은 주소의 화면에서 요청해 주세요.')
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':
                raise Problem(415,'JSON 요청만 지원해요.')
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=8192: raise Problem(400,'요청 크기가 올바르지 않아요.')
            body=json.loads(self.rfile.read(size))
            if not isinstance(body,dict): raise Problem(400,'요청 형식이 올바르지 않아요.')
            p=urlsplit(self.path).path
            store=self.server.store
            cookie=None
            if p=='/api/admin/login':
                if not isinstance(body.get('key'),str) or not secrets.compare_digest(body['key'],self.server.admin_key):
                    raise Problem(401,'관리자 키를 확인해 주세요.')
                cookie=f'simus_admin={self.server.admin_session}; HttpOnly; SameSite=Strict; Path=/'
                data=dict(ok=True)
            elif p.startswith('/api/admin/'):
                if not self.admin_valid(): raise Problem(403,'관리자 로그인이 필요해요.')
                if p=='/api/admin/start': data=store.start(body.get('duration',600),body.get('scale',0.1))
                elif p=='/api/admin/finish':
                    if body.get('confirmed') is not True: raise Problem(400,'최종 종료를 확인해 주세요.')
                    data=store.finish(body['round'])
                else: raise Problem(404,'없는 주소예요.')
            elif p=='/api/join':
                token=store.join(self.cookie('simus_visitor'),body['round'])
                cookie=f'simus_visitor={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000'
                data=dict(ok=True)
            elif p=='/api/choice':
                for k in ('round','situation','choice','request'):
                    if not isinstance(body.get(k),str): raise Problem(400,'선택 정보가 올바르지 않아요.')
                data=store.choose(self.cookie('simus_visitor'),body['round'],body['situation'],body['choice'],body['request'],received)
            else: raise Problem(404,'없는 주소예요.')
            self.send_json(data,cookie=cookie)
        except Problem as e: self.send_json(dict(error=e.message),e.status)
        except (ValueError,KeyError,TypeError): self.send_json(dict(error='요청 내용을 확인해 주세요.'),400)
        except Exception:
            import traceback
            traceback.print_exc()
            self.send_json(dict(error='저장에 실패했어요. 잠시 뒤 다시 시도해 주세요.'),500)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--public-url',help='Same-Wi-Fi URL shown in the QR code')
    args=parser.parse_args()
    data=ROOT/'data'
    data.mkdir(exist_ok=True,mode=0o700)
    keyfile=data/'admin-key.txt'
    if not keyfile.exists():
        fd=os.open(keyfile,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as f: f.write(secrets.token_urlsafe(24))
    store=Store(data/'simus.sqlite3')
    try: store.state()
    except Problem as e:
        if e.status==404: store.start(1800)
        else: raise
    server=ThreadingHTTPServer((args.host,args.port),Handler)
    server.store=store
    server.admin_key=keyfile.read_text().strip()
    server.admin_session=secrets.token_urlsafe(32)
    server.public_url=args.public_url or f'http://127.0.0.1:{args.port}/'
    stop=threading.Event()
    def ticker():
        while not stop.wait(0.2):
            try: store.tick()
            except Exception as e: print('종료 처리 재시도:',type(e).__name__,flush=True)
    threading.Thread(target=ticker,daemon=True).start()
    print(f'SIM:US http://127.0.0.1:{args.port}/ | 전시장 /display | 관리자 /admin',flush=True)
    print(f'관리자 키 파일: {keyfile}',flush=True)
    print(f'휴대폰 접속 주소: {server.public_url}',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally:
        stop.set()
        server.server_close()


if __name__=='__main__': main()
