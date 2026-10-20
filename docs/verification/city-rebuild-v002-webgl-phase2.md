# CityRebuild_v002 WebGL Phase 2 — 서버 보행 그래프

## 데이터와 적용 범위

`python3 scripts/unity/export-city-rebuild-v002-graph.py`가 저장된 Unity 씬의 `CityV002PedestrianGraph`를 읽어 `web/src/lib/data/city-rebuild-v002-graph.json`으로 내보낸다. 노드 572개, 무방향 간선 597개, 간선 ID·종류·폭·3차원 폴리라인을 보존한다. 하천 확장이 없는 최초 layout의 388/409 그래프로 대체하지 않는다. `--check`는 씬·layout SHA-256, 간선 끝점, 계층 identity 및 JSON 최신 여부를 검증한다. Unity를 실행하거나 씬을 저장하지 않는다.

좌표는 Unity 월드 미터 `[x,y,z]`, Y-up이며 서버 변환은 identity다. 상위 계층의 이동 0, 회전 identity, 축척 1을 내보내기 때 확인한다. 노드의 `Y=0.16`과 하천 산책로의 높이를 그대로 보존한다. 시제품 좌표·축 변환·lane offset을 추가하지 않는다.

- `map_version`: Phase 1 테스트 빌드와 같은 `test-only-city-rebuild-v002-webgl-v1`.
- `path_version`: `city-rebuild-v002-walk-v1`.
- 전시 승인 버전이 아니며 최종 30개 상황 좌표 및 지역 경계는 확정하지 않는다.

## 새 DRAFT 준비

서버 배포 전에 `db/014_participant_glasses.sql`까지 적용된 DB에 `db/015_npc_graph_guidance.sql`을 한 번 적용한다. 새 nullable 유도 경로와 생성 요청 프로필 열만 추가하며 기존 회차·가입 경로·이벤트 상태의 데이터를 UPDATE하지 않는다. 이번 검증은 별도 임시 PostgreSQL 클러스터에서만 수행한다. 운영 DB 적용 및 서버/운영 `/city` 배포는 수행하지 않는다.

기존 관리자 `POST /api/admin/sessions`의 생성 본문에 `"npc_profile":"city-rebuild-v002"`를 추가하면 새 DRAFT에만 그래프 경로를 설정한다. 나머지 필드(`template_session_id`, `name`, `duration_seconds`, `impact_scale`, `request_key`)와 인증 계약은 동일하다. 프로필은 생성 요청에 저장되어 재시도/요청 키 충돌도 검사한다. 프로필을 생략한 기존 생성 동작은 유지한다.

기본 경로는 `CAMPUS_PLAZA → B04_ACCESS → B16_ACCESS → PARK_REST_2 → CAMPUS_PLAZA`의 각 구간을 거리 가중 Dijkstra로 연결한 64개 점, 1.4m/s 순환 경로다. B04/B16은 외부 접근 앵커이며 실제 출입문 확정을 의미하지 않는다. 이전 맵 이벤트 좌표와 지역 `map_metadata`는 새 프로필 회차에 복사하지 않는다. 콘텐츠·점수·논리 지역은 기존 복제 계약을 유지한다. 시작 전 이벤트 위치 API로 실제 v002 그래프 위의 좌표를 설정할 수 있으며, 임의 건물/수면 좌표는 거부한다.

기존 NPC 경로 설정 API도 v002 버전에서는 각 입력점 사이 및 순환의 마지막 구간을 그래프로 확장한다. 등록되지 않은 `path_version`, 그래프 밖 좌표, 연결되지 않은 목적지, 2048점을 넘는 기본 경로를 거부한다. 기존 버전은 기존 폴리라인 검증을 사용한다.

## 이동·이벤트 계약

가입 시 `participant_sessions.npc_motion`과 입장 시각의 불변 스냅샷을 유지한다. 기본 이동·유도·정지는 기존 `npcPosition` 보간을 사용하며 입장 시각, `motion_epoch`, 누적 `paused_ms`, 회차 종료 freeze를 따른다. 공개 응답의 필드와 위치 계산 방식은 바꾸지 않는다.

60초 유도 시 현재 간선 위 위치부터 목적지까지 탐색한 폴리라인을 `npc_event_states.guidance_motion`에 영속화한다. 출발/목표/시작 시각과 함께 저장하므로 재시작 후에도 같은 경로를 계산한다. v002 근접 이벤트는 그래프 거리를 확인하여 물/건물 반대편의 유클리드 반경만으로 발생하지 않는다. 90초에는 기존 미응답·미배치 상황 후보를 우선 사용한다. v002에서 위치 있는 후보만 남으면 도달 가능한 미응답 후보를 현재 실제 보행 위치에서 DEADLINE으로 시작한다. 순간이동은 하지 않는다. 모든 후보 소진 후 반복하지 않는 기존 정책은 유지한다.

ACTIVE 이벤트는 시작 시각의 실제 폴리라인 위치에 정지한다. 완료 후 현재 위치에서 원래 경로의 가까운 앵커로 그래프 연결 구간을 한 번 이동한다. 연결 구간과 원래 경로는 `resume_motion`의 `rejoin_after_ms`/`rejoin_motion`에 분리해 저장한다. 서버는 연결 구간의 소요 시간 이후 원래 경로를 해당 앵커부터 재개하므로 이벤트 지점을 매 순환마다 재방문하지 않는다. 연결 구간을 원래 2048점 경로에 붙여 크기 제한을 초과하지 않는다. 이후 이벤트 정지 시간은 기존 `paused_ms`로 반영한다.

v002 응답 revision은 `2 * motion_revision + rejoined`로 계산하여 연결 구간→원래 경로 전환에도 증가한다. 상태 변경은 기존 DB revision을 증가시키므로 다음 전환도 항상 더 큰 revision을 가진다. 기존 맵의 revision 값은 바꾸지 않는다. 기존 회차 잠금·ACTIVE 부분 유일 인덱스·선택 요청 멱등성·미응답 상황 필터를 유지한다.

## 재현 명령과 검증

```sh
python3 scripts/unity/export-city-rebuild-v002-graph.py --check
node web/tests/city-v002-graph.mjs
cd web
npm run build
npm run test:integration
```

그래프 검사: 전체 572개 노드 도달, 기본 이동/순환 연결, 보간 위치, 반대편 하안의 보행교 우회, 잘못된 좌표/버전 거부 통과. 전체 간선을 0.3m 간격으로 검사한 35,481개 샘플에서 69동 건물 footprint 내부 통과 0개. 수변 237개 샘플은 설계 보행교 폭·높이 안에 있다. 이는 서버 경로/설계 외곽 검사이며 새 Unity Physics 또는 WebGL NPC 렌더링 검증을 뜻하지 않는다.

2026-10-19 격리 통합 검사 통과: 새 DRAFT 및 기존 회차/가입 스냅샷 불변, 입장 epoch, 기본 이동, 이벤트 유도/실제 목적지 도착, ACTIVE 정지, 실제 서버 재시작 후 같은 이벤트 ID, 동시 이벤트 조회 8건의 단일 ACTIVE, 동시 선택 4건의 단일 반영, 그래프 복귀 및 원래 순환 경로 전환/revision 증가, 간선 중간의 90초 중단·정지·복귀, 회차 종료 freeze를 확인했다.

기존 NPC 위치/이벤트 통합 회귀도 통과했다. 기존 지도 버전 호환, 정지 시간 보정, 미배치 30상황 중복 없음, 소진 후 재발생 없음, 1,000명 스케줄러 일괄 처리를 포함한다. 임시 클러스터 `/var/folders/1k/_rg_csns6wv0s0t2hqpkvbdm0000gn/T/simus-integration-GumnxH`에서 실행하고 소유 서버·DB를 종료했다. 개발 DB 연결·운영 데이터 변경은 하지 않았다.

`npm run build` 및 변경 코드 ESLint 통과. 통합 실행의 브라우저 UI/Unity Play 검사는 환경 변수를 지정하지 않아 SKIP이며 PASS 범위에 포함하지 않는다. UI·Unity 변경이 없어 이번 서버/API 검증에는 사용하지 않았다. `python3 scripts/assets/catalog.py` 및 `--check`는 5,205파일·오류 0개로 통과했고, `git diff --check`도 통과했다.

Unity 맵·카메라·웹 UI·운영 `/city` 빌드를 변경하지 않았다. Phase 1 테스트 WebGL은 여전히 지도 표시 전용이며 이번 단계는 서버 경로 계산과 API 검증이다.
