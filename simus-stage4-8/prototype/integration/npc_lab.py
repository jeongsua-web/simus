#!/usr/bin/env python3
"""Isolated mock NPC position experiment. No production participant records."""
import argparse
import json
import secrets
import time
import uuid
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1] / 'client/lab'
ROUND = str(uuid.uuid4())
EPOCH = time.time()
VISITORS = {}
PATH = [{'x':-64,'y':1.4,'z':12},{'x':-64,'y':1.4,'z':45}]


def position(now, phase):
    distance = ((now - EPOCH) * 2 + phase) % 66
    return {'x':-64,'y':1.4,'z':12 + distance if distance <= 33 else 78 - distance}


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, body, kind='application/json; charset=utf-8', cookie=None):
        self.send_response(status)
        self.send_header('Content-Type', kind)
        self.send_header('Cache-Control', 'no-store')
        if cookie: self.send_header('Set-Cookie', cookie)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def json(self, status, obj, cookie=None):
        self.respond(status, json.dumps(obj, ensure_ascii=False).encode(), cookie=cookie)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path in ('/','/index.html'):
            return self.respond(200, (ROOT/'index.html').read_bytes(), 'text/html; charset=utf-8')
        if path != '/api/lab/npc':
            return self.json(404, {'error':'lab endpoint 없음'})
        jar = cookies.SimpleCookie()
        try: jar.load(self.headers.get('Cookie',''))
        except cookies.CookieError: pass
        token = jar['simus_lab'].value if 'simus_lab' in jar else None
        if token not in VISITORS:
            token = secrets.token_urlsafe(24)
            VISITORS[token] = {'id':str(uuid.uuid4()),'phase':len(VISITORS)*11}
        now = time.time()
        visitor = VISITORS[token]
        self.json(200, {'mock':True,'round':ROUND,'npc_id':visitor['id'],'map_version':'neighborhood-preview-1',
                        'coordinates':'Unity XZ meters, Y up','path':PATH,'speed':2,'phase':visitor['phase'],'epoch':EPOCH,
                        'server_time':now,'position':position(now,visitor['phase']),
                        'state_version':0,'stopped':False},
                  f'simus_lab={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--port',type=int,default=8790)
    args=p.parse_args()
    print(f'NPC MOCK LAB http://127.0.0.1:{args.port}/',flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()


if __name__ == '__main__': main()
