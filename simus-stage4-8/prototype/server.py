#!/usr/bin/env python3
"""LAN prototype HTTP API backed by PostgreSQL. See SERVER_README.md."""
import argparse
import json
import os
import secrets
import threading
import uuid
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

from store import Store, Problem
from datetime import datetime
from decimal import Decimal

ROOT = Path(__file__).resolve().parent


def json_value(value):
    if isinstance(value, Decimal): return float(value)
    if isinstance(value, datetime): return value.isoformat()
    if isinstance(value, uuid.UUID): return str(value)
    raise TypeError(type(value).__name__)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT/'web'),**kwargs)

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

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
        raw=json.dumps(data,ensure_ascii=False,default=json_value,allow_nan=False).encode()
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
            except Exception:
                self.send_json(dict(error='서버 연결을 확인해 주세요.'),503)
            return
        self.send_json(dict(error='현재는 DB·서버 API 단계입니다. 모바일 화면과 Unity 연결은 다음 단계입니다.'),404)

    def do_HEAD(self):
        self.send_response(405)
        self.end_headers()

    def admin_valid(self):
        value=self.cookie('simus_admin')
        return bool(value) and secrets.compare_digest(value,self.server.admin_session)

    def do_POST(self):
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
                if p=='/api/admin/start': data=store.start(body.get('duration',300),body.get('scale',0.1))
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
                data=store.choose(self.cookie('simus_visitor'),body['round'],body['situation'],body['choice'],body['request'])
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
    dsn=os.environ.get('DATABASE_URL')
    admin_id=os.environ.get('SIMUS_ADMIN_ID')
    if not dsn or not admin_id:
        parser.error('DATABASE_URL과 SIMUS_ADMIN_ID를 설정해 주세요. SERVER_README.md 참고')
    store=Store(dsn,admin_id)
    with store.tx() as db:
        store._admin(db)
        db.execute('SELECT 1 FROM session_closures LIMIT 1')
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
    print(f'SIM:US API http://{args.host}:{args.port}/api/state',flush=True)
    print(f'관리자 키 파일: {keyfile}',flush=True)
    print(f'휴대폰 접속 주소: {server.public_url}',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally:
        stop.set()
        server.server_close()


if __name__=='__main__': main()
