#!/bin/zsh
set -eu
PROJECT='/Users/jeongsua/.codex/.chatgpt-projects/g-p-6aa6fb9954b08191930875ad1e173e1c'
PG_BIN='/opt/homebrew/opt/postgresql@18/bin'
PG_DATA='/tmp/simus-stage48-pg'
PG_SOCKET='/tmp/simus-stage48-socket'
RUN_DIR='/tmp/simus-stage48-manual'
API_PID=''
WEB_PID=''
fail() { print "\n실행 중지: $1"; read -r "?Enter 키를 누르면 닫힙니다. "; exit 1; }
cleanup() {
  [[ -z "$WEB_PID" ]] || kill "$WEB_PID" 2>/dev/null || true
  [[ -z "$API_PID" ]] || kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
[[ -f "$PG_DATA/PG_VERSION" ]] || fail '검증용 임시 DB가 없어졌습니다. DB 재준비가 필요합니다.'
[[ -x "$PROJECT/prototype/.venv/bin/python" ]] || fail '프로젝트 Python 실행 환경을 찾지 못했습니다.'
for port in 8769 8782; do
  if /usr/sbin/lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    fail "$port 포트를 사용 중입니다. 이전 테스트 서버 터미널에서 Ctrl+C 후 다시 실행하세요."
  fi
done
mkdir -p "$PG_SOCKET" "$RUN_DIR"
if ! "$PG_BIN/pg_ctl" -D "$PG_DATA" status >/dev/null 2>&1; then
  "$PG_BIN/pg_ctl" -D "$PG_DATA" -l "$RUN_DIR/postgres.log" -o "-k $PG_SOCKET -p 55448 -h 127.0.0.1" start || fail '테스트 DB를 시작하지 못했습니다.'
fi
export DATABASE_URL="host=$PG_SOCKET port=55448 dbname=simus_stage48_live user=simus_stage48_runtime"
export SIMUS_ADMIN_ID='00000000-0000-0000-0000-000000000001'
"$PROJECT/prototype/.venv/bin/python" "$PROJECT/prototype/server.py" --port 8769 > "$RUN_DIR/api.log" 2>&1 &
API_PID=$!
python3 "$PROJECT/prototype/client_gateway.py" --port 8782 --upstream http://127.0.0.1:8769 --label '시제품 전용 테스트 DB' > "$RUN_DIR/web.log" 2>&1 &
WEB_PID=$!
ready=0
for attempt in {1..30}; do
  if /usr/bin/curl -fsS http://127.0.0.1:8782/api/config > /dev/null 2>&1; then ready=1; break; fi
  sleep 0.3
done
[[ "$ready" == 1 ]] || fail "API 연결 실패. 로그: $RUN_DIR/api.log, web.log"
print '\nSIM:US 최소 시제품 테스트 서버가 켜졌습니다.'
print '이 터미널을 켜 둔 채 테스트하세요. 종료는 Ctrl+C입니다.'
print '관리자: http://127.0.0.1:8782/admin/'
print '참여자: http://127.0.0.1:8782/mobile/'
print "관리자 키 파일: $PROJECT/prototype/data/admin-key.txt"
print '관리자 키는 지금 열리는 텍스트 파일의 한 줄 전체를 복사해 로그인하세요.'
print 'Unity: NeighborhoodLive.unity 장면을 열고 Play. API Base는 http://127.0.0.1:8782'
print '이 실행 파일은 이 Mac 전용입니다. 휴대폰 접속용 LAN 공개는 하지 않습니다.'
/usr/bin/open -a TextEdit "$PROJECT/prototype/data/admin-key.txt"
/usr/bin/open 'http://127.0.0.1:8782/admin/'
while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do sleep 1; done
fail "서버가 종료되었습니다. 로그: $RUN_DIR"
