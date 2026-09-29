const $ = id => document.getElementById(id);
let round = null, authenticated = false, connected = false, busy = false, refreshing = false, mode = null;
let confirmationRound = null, pendingStart = null;
try { pendingStart = JSON.parse(sessionStorage.getItem('simus-admin-pending-start') || 'null'); } catch { /* Optional recovery storage unavailable. */ }
const say = message => { $('message').textContent = message; };
const date = value => value ? new Date(value).toLocaleString('ko-KR', {hour12:false}) : '—';
async function api(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(path, {credentials:'same-origin', cache:'no-store', signal:controller.signal,
      ...(body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || `서버 오류 (${response.status})`), {status:response.status});
    return data;
  } finally { clearTimeout(timeout); }
}
function savePending(value) {
  pendingStart = value;
  try { if (value) sessionStorage.setItem('simus-admin-pending-start', JSON.stringify(value)); else sessionStorage.removeItem('simus-admin-pending-start'); } catch { /* In-memory guard remains active. */ }
}
function controls() {
  $('login-panel').hidden = authenticated;
  $('operations').hidden = !authenticated;
  $('start-button').disabled = busy || !connected || !mode || !!pendingStart || !!(round && round.status !== 'FINALIZED');
  $('finish-open').disabled = busy || !connected || !mode || !round || round.status !== 'RUNNING';
  $('finish-button').disabled = busy || !connected || !$('confirm-check').checked || !round || round.id !== confirmationRound || round.status !== 'RUNNING';
  $('login').querySelector('button').disabled = busy || !mode;
}
function closeConfirmation() {
  confirmationRound = null;
  $('confirmation').hidden = true;
  $('confirm-check').checked = false;
}
function render(state) {
  const incoming = state.round;
  if (round && incoming && round.id === incoming.id && incoming.version < round.version) return;
  round = incoming;
  if (confirmationRound && (!round || confirmationRound !== round.id || round.status !== 'RUNNING')) closeConfirmation();
  $('server-time').textContent = date(state.server_time);
  $('round-id').textContent = round ? `${round.name} · ${round.id}` : '아직 시작한 회차가 없습니다.';
  const status = !round ? '회차 대기' : round.status === 'FINALIZED' ? '결과 공개' : round.status === 'CLOSING' ? '종료 준비' : round.status === 'RUNNING' ? (round.accepting ? '선택 접수 중' : '입력 마감') : round.status;
  $('phase').textContent = status;
  $('phase-note').textContent = !round ? '로그인 후 첫 회차를 시작할 수 있습니다.' : round.status === 'FINALIZED' ? '서버가 최종 결과를 확정했습니다. 본인 결과는 각 참여자 화면에서 확인합니다.' : round.status === 'CLOSING' ? '서버가 미완료 요청을 정리하고 결과를 확정하고 있습니다.' : !round.accepting ? '신규 선택을 받지 않습니다. 서버의 결과 확정을 기다리고 있습니다.' : '서버가 신규 선택을 접수하고 있습니다.';
  for (const key of ['cutoff','ends','ended']) $(key).textContent = date(round?.[key]);
  for (const key of ['happiness','safety','cleanliness','pollution']) $(key).textContent = round ? `${Number(round[key]).toFixed(1)}${key === 'pollution' ? '%' : ''}` : '—';
  $('version').textContent = round ? `도시 버전 ${round.version} · 반영된 응답 ${round.responses}건 · 종료 방식 ${round.mode || '미정'}` : '도시 상태 없음';
  $('start-title').textContent = round?.status === 'FINALIZED' ? '다음 회차 시작' : '새 회차 시작';
  if (pendingStart && round && round.id !== pendingStart.previous) {
    savePending(null);
    say('서버에서 새 회차를 확인했습니다. 시작 요청을 재전송하지 않았습니다.');
  }
}
async function refresh() {
  if (refreshing || busy) return;
  refreshing = true;
  try {
    const config = await api('/api/config');
    authenticated = config.admin === true;
    let state;
    try { state = await api('/api/state'); }
    catch (error) { if (error.status === 404) state = {round:null,server_time:null}; else throw error; }
    render(state);
    connected = true;
    $('connection').textContent = `연결됨 · 마지막 조회 ${new Date().toLocaleTimeString('ko-KR')}`;
    if (pendingStart) say('시작 요청 결과를 확인 중입니다. 중복 회차 방지를 위해 시작을 잠갔습니다. 서버 운영 기록을 확인해 주세요.');
  } catch (error) {
    connected = false;
    $('connection').textContent = '연결 실패 · 마지막 확인 상태 표시 중';
    say(error.status ? error.message : '서버 응답을 확인하지 못했습니다. 자동으로 다시 조회합니다.');
  } finally { refreshing = false; controls(); }
}
async function mutate(work) {
  if (busy || refreshing) { say('현재 상태를 조회 중입니다. 잠시 후 다시 눌러 주세요.'); return; }
  busy = true; controls();
  try { await work(); }
  catch (error) {
    if (error.status === 401 || error.status === 403) authenticated = false;
    say(error.status ? error.message : '요청 결과를 확인하지 못했습니다. 서버 상태를 다시 조회합니다. 성공으로 간주하지 않습니다.');
  } finally { busy = false; controls(); await refresh(); }
}
$('login').addEventListener('submit', event => {
  event.preventDefault();
  const key = $('key').value; $('key').value = '';
  if (!mode) return;
  mutate(async () => { await api('/api/admin/login', {key}); authenticated = true; say('관리자 인증을 확인했습니다.'); });
});
$('start').addEventListener('submit', event => {
  event.preventDefault();
  if ($('start-button').disabled) return;
  const duration = Number($('duration').value);
  if (!Number.isInteger(duration) || duration < 10 || duration > 86400) { say('회차 길이는 10~86,400 사이의 정수로 입력해 주세요.'); return; }
  mutate(async () => {
    savePending({previous:round?.id || null});
    say('회차 시작 요청 중 · 서버 확인을 기다립니다.');
    try {
      await api('/api/admin/start', {duration,scale:0.1});
      say('시작 요청 응답을 받았습니다. 현재 회차를 다시 확인합니다.');
    } catch (error) {
      // Only definite client rejection permits a new attempt. Transport/5xx may have committed.
      if (error.status >= 400 && error.status < 500) savePending(null);
      throw error;
    }
  });
});
$('finish-open').addEventListener('click', () => {
  if ($('finish-open').disabled) return;
  confirmationRound = round.id;
  $('confirm-round').textContent = `종료할 회차: ${confirmationRound}`;
  $('confirmation').hidden = false;
  $('confirm-check').checked = false; controls(); $('confirm-check').focus();
});
$('finish-button').addEventListener('click', () => {
  if ($('finish-button').disabled) return;
  const target = confirmationRound;
  mutate(async () => {
    say('종료 요청 중 · 서버 결과 확정을 기다립니다.');
    const result = await api('/api/admin/finish', {round:target,confirmed:true});
    say(result.id === target && result.status === 'FINALIZED' ? '서버가 해당 회차의 최종 결과 확정을 확인했습니다.' : '종료 요청 응답을 받았습니다. 서버 상태를 계속 확인합니다.');
    closeConfirmation();
  });
});
$('confirm-check').addEventListener('change', controls);
$('cancel').addEventListener('click', () => { closeConfirmation(); controls(); });
$('refresh').addEventListener('click', refresh);
async function boot() {
  controls();
  try {
    const config = await api('/client-config.json');
    if (!['live','mock'].includes(config.mode)) throw new Error('invalid mode');
    mode = config.mode;
    $('mode').textContent = mode === 'mock' ? '모의 모드 · 테스트 데이터 · 실제 서버에 반영되지 않습니다.' : '실제 API 연결 모드 · 연결 성공 여부는 아래 상태를 확인하세요.';
    $('mode').classList.toggle('mock', mode === 'mock');
  } catch { $('mode').textContent = '데이터 연결 유형 확인 실패 · 운영 잠금'; say('개발 프록시의 /client-config.json 설정을 확인해 주세요.'); }
  await refresh(); setInterval(refresh, 1000);
}
boot();
