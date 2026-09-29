#!/usr/bin/env python3
"""Development UI host and transparent same-origin proxy for the existing API."""
import argparse
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.client import RemoteDisconnected
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

CLIENT = Path(__file__).resolve().parent / 'client'
MAX_BODY = 8192


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send_body(self, status, body, content_type, headers=()):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        for name, value in headers:
            if name.lower() in ('set-cookie',):
                self.send_header(name, value)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith('/api/'):
            return self.proxy()
        if path == '/client-config.json':
            data = json.dumps({'mode': 'live', 'label': self.server.label}, ensure_ascii=False).encode()
            return self.send_body(200, data, 'application/json; charset=utf-8')
        if path == '/':
            path = '/mobile/'
        if path in ('/mobile', '/admin'):
            path += '/'
        if path.endswith('/'):
            path += 'index.html'
        target = (CLIENT / path.lstrip('/')).resolve()
        if not target.is_relative_to(CLIENT) or not target.is_file():
            return self.send_body(404, b'Not found', 'text/plain')
        data = target.read_bytes()
        mime = mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
        self.send_body(200, data, mime + ('; charset=utf-8' if mime.startswith('text/') or mime == 'application/javascript' else ''))

    def do_POST(self):
        self.proxy()

    def proxy(self):
        if not urlsplit(self.path).path.startswith('/api/'):
            return self.send_body(404, json.dumps({'error':'없는 주소예요.'}, ensure_ascii=False).encode(), 'application/json')
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size < 0 or size > MAX_BODY:
                raise ValueError()
        except ValueError:
            return self.send_body(400, json.dumps({'error':'요청 크기를 확인해 주세요.'}, ensure_ascii=False).encode(), 'application/json')
        data = self.rfile.read(size) if self.command == 'POST' else None
        headers = {'Host': self.headers.get('Host', ''), 'Accept': 'application/json'}
        for name in ('Cookie', 'Origin', 'Content-Type'):
            if name in self.headers:
                headers[name] = self.headers[name]
        req = Request(self.server.upstream + self.path, data=data, headers=headers, method=self.command)
        try:
            with urlopen(req, timeout=10) as resp:
                self.send_body(resp.status, resp.read(), resp.headers.get('Content-Type', 'application/json'), resp.headers.items())
        except HTTPError as error:
            self.send_body(error.code, error.read(), error.headers.get('Content-Type', 'application/json'), error.headers.items())
        except (URLError, TimeoutError, RemoteDisconnected, ConnectionError):
            self.send_body(502, json.dumps({'error':'실제 API 서버에 연결할 수 없어요. 모의 데이터로 전환되지 않았습니다.'}, ensure_ascii=False).encode(), 'application/json; charset=utf-8')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--host', default='127.0.0.1')
    p.add_argument('--port', type=int, default=8780)
    p.add_argument('--upstream', default='http://127.0.0.1:8765')
    p.add_argument('--label', default='개발 서버 데이터')
    args = p.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.upstream = args.upstream.rstrip('/')
    server.label = args.label
    print(f'SIM:US UI http://{args.host}:{args.port}/mobile/ /admin/ -> {server.upstream}', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
