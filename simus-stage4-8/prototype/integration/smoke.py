"""Run only against the disposable stage4-8 test DB/API, never a deployed server."""
import json
import os
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener
from uuid import uuid4

BASE = os.environ.get('SIMUS_SMOKE_BASE','http://127.0.0.1:8780')
KEY = Path(__file__).resolve().parents[1] / 'data/admin-key.txt'


def client():
    return build_opener(HTTPCookieProcessor(CookieJar()))


def call(opener, path, body=None):
    raw = None if body is None else json.dumps(body).encode()
    request = Request(BASE + path, raw, {'Content-Type':'application/json'} if raw else {}, method='POST' if raw else 'GET')
    try:
        with opener.open(request, timeout=12) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, json.load(error)


def check(ok, message):
    if not ok:
        raise AssertionError(message)


def main():
    admin, one, two, stranger = [client() for _ in range(4)]
    check(call(admin, '/client-config.json')[1]['mode'] == 'live', 'gateway mode')
    check(call(stranger, '/api/admin/finish', {'round':str(uuid4()),'confirmed':True})[0] == 403, 'unauthorized finish')
    check(call(admin, '/api/admin/login', {'key':KEY.read_text().strip()})[0] == 200, 'admin login')
    first = call(admin, '/api/admin/start', {'duration':300,'scale':0.1})[1]
    rid = first['id']
    check((first['happiness'],first['safety'],first['cleanliness'],first['pollution'],first['version']) == (50,50,50,0,0), 'initial city')
    for person in (one,two):
        check(call(person, '/api/join', {'round':rid})[0] == 200, 'join')
    state1 = call(one, '/api/me?round='+rid)[1]
    state2 = call(two, '/api/me?round='+rid)[1]
    s = state1['situations'][0]
    body1 = {'round':rid,'situation':s['id'],'choice':s['choices'][0]['id'],'request':str(uuid4())}
    body2 = {'round':rid,'situation':s['id'],'choice':s['choices'][1]['id'],'request':str(uuid4())}
    check(state1['result'] is None and state2['result'] is None and 'alignment_dx' not in str(state1), 'privacy before finish')
    check(call(one, '/api/choice', body1)[1]['version'] == 1, 'first choice')
    check(call(two, '/api/choice', body2)[1]['version'] == 2, 'second choice')
    check(call(one, '/api/choice', body1)[1]['replayed'] is True, 'replay')
    check(call(one, '/api/choice', {**body1,'request':str(uuid4())})[0] == 409, 'duplicate situation')
    city = call(admin, '/api/state')[1]['round']
    check((city['happiness'],city['cleanliness'],city['version']) == (50.3,50.5,2), 'shared city')
    check(call(one, '/api/me?round='+rid)[1]['result'] is None, 'no early result')
    check(call(admin, '/api/admin/finish', {'round':rid,'confirmed':True})[1]['status'] == 'FINALIZED', 'manual finish')
    check(call(one, '/api/me?round='+rid)[1]['result']['x'] == 1 and call(two, '/api/me?round='+rid)[1]['result']['x'] == 0, 'private results')
    check(call(one, '/api/me?round='+rid)[1]['answers'][0]['choice_id'] == body1['choice'], 'cookie recovery')
    check(call(one, '/api/choice', body1)[1]['replayed'] is True, 'replay after finish')
    check(call(admin, '/api/admin/finish', {'round':rid,'confirmed':True})[1]['version'] == 2, 'single final')
    second = call(admin, '/api/admin/start', {'duration':300,'scale':0.1})[1]
    check(second['id'] != rid and second['version'] == 0 and second['happiness'] == 50, 'new round reset')
    check(call(one, '/api/join', {'round':second['id']})[0] == 200, 'same participant next round')
    check(any(h['id'] == rid for h in call(one, '/api/me?round='+second['id'])[1]['history']), 'history retained')
    check(call(one, '/api/choice', {**body1,'request':str(uuid4())})[0] == 409, 'old round rejected')
    check(call(admin, '/api/state')[1]['round']['version'] == 0, 'new round not contaminated')
    call(admin, '/api/admin/finish', {'round':second['id'],'confirmed':True})
    print('PASS: gateway, auth, 2 participants, shared city, replay, privacy, recovery, finish, two rounds')


if __name__ == '__main__':
    main()
