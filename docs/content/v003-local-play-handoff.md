# v003 광장 상황 로컬 플레이 인계

이 문서의 기본 로컬 테스트는 원본 콘텐츠 `EXHIBITION_30`(도시 광장의 정체불명 상자)을 기준으로 한다. 씬 위치와 후보 접근 경로는 [30행 배치표](v003-event-placement.csv)에 있다.

## 참여 화면의 전체 상황 테스트

개발 서버의 `/participate`에서 **테스트할 상황**을 선택하면 30개 상황을 개별적으로 확인할 수 있다. 12번 이동 수단과 26번 정전은 현재 위치에서 시작한다. 그 외 상황은 광장 경로 또는 Unity 보행 메시와 씬 충돌 검사를 통과한 테스트 경로를 사용한다. 상대 NPC를 만나는 상황은 상대의 현재 위치를 기준으로 발생하고, 건물 상황에서는 외부 입구에 도착하면 시민 NPC를 숨긴다.

경로를 다시 만들려면 Unity의 `CityMasterplanV003EventRouteAudit.Export`를 실행하고 `SIMUS_V003_EVENT_ROUTE_RUNTIME_OUTPUT`에 `web/src/lib/routes/data/v003-event-routes.json`의 절대 경로를 지정한다. `CityMasterplanV003LocalBuild.Build`의 출력에 생성된 WebGL 파일 전체를 개발 서버의 `web/public/unity/city-masterplan-v003-local-v1/event-tests/`에 설치한다. 일반 회차의 위치 설정은 광장 경로 계약을 따른다.

## 시작

저장소 루트에서 다음 명령을 실행한다. PostgreSQL 18(`/opt/homebrew/opt/postgresql@18/bin`), Node와 설치된 `web/node_modules`, 실제 v003 WebGL 산출물이 필요하다.

```sh
node scripts/dev/v003-local.mjs
```

`READY`가 출력되면 새 시크릿 창에서 <http://127.0.0.1:3210/v003-test>에 접속한다. 실행기는 매번 새 임시 PostgreSQL 클러스터(55443)를 만들고 관리형 마이그레이션·원본 시드·DRAFT 패치를 적용한다. 빌드 검사를 통과하면 회차를 시작한다. Ctrl+C로 실행기가 소유한 서버와 DB를 중지한다. 포트 변경은 `V003_WEB_PORT`, `V003_PG_PORT`를 사용한다. 실행 로그에 출력된 임시 디렉터리의 `local-state.json`에는 로컬 관리자 토큰이 있으므로 공유하지 않는다. 실행기를 재시작한 뒤 인증 만료가 표시되면 이전 시크릿 창을 모두 닫고 새 시크릿 창에서 다시 입장한다.

## 클릭 순서와 기대 동작

1. 시민 정보를 입력하고 입장한다. 실제 도시가 준비되고 본인 NPC 추적 상태가 될 때까지 기다린다.
2. **새로운 상황 만나기**를 누른다. NPC가 광장 상자 옆 대기점까지 검증된 경유점을 따라 걷는다. 버튼을 누르기 전에는 출발점에서 기다린다.
3. 서버가 도착을 확정하면 NPC가 멈추고 원본 문항·선택지가 표시된다.
4. 선택지를 고르고 제출한다. 해당 선택의 실제 행복·치안·청결 변화량만 표시된다. 개인 성향은 표시하지 않으며 NPC도 계속 기다린다.
5. **확인하고 이동 재개**를 누른다. NPC가 출발점 방향으로 돌아간다. 이 최소 테스트의 재개 경로는 왕복 한 번이며 무한 자유 보행은 후속 작업이다.

대표 상황은 시민당 한 번이다. 다시 시험하려면 새 브라우저 프로필을 사용하거나 실행기를 재시작해 새 격리 회차를 만든다. 통신이 끊기면 **같은 요청으로 다시 확인**을 눌러 저장한 요청을 재전송한다.

## 버전과 근거

- 기준 씬: `unity/Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_EventPlaces.unity`
- map: `city-masterplan-v003-local-v1`
- path: `city-masterplan-v003-plaza30-v1`
- 실제 WebGL 공개 경로: `web/public/unity/city-masterplan-v003-local-v1`
- 좌표·속도·정지 반경·재개 경로: [경로 계약](v003-local-route.json)
- 원본·교환본·해시·좌표 대조: [자산 근거](../verification/v003-map-asset-basis.md)
- 실행 결과와 미검증 항목: [독립 QA](../verification/v003-local-qa.md)

저장 씬의 `FULL_EVENT_30_INTERACT`와 서버 정지점은 별개다. 상자와의 간섭을 피하려고 저장된 NPC 대기점 쪽을 검사한다. 최종 좌표와 Unity 물리 검사 상태는 경로 계약 및 QA 기록을 기준으로 확인한다. 이전 Neighborhood 좌표는 사용하지 않는다.

## 차량 통행

- 승용차는 R02 → R04 → R09 → R03의 우측 차로를 최고 4m/s로 계속 순환한다.
- 버스는 R01 동쪽 방향으로 최고 6m/s로 주행한다. 기존 정류장 위치(92, 47.5)에서 5초 정차한다. 동쪽 도로 끝에 도착하면 3초 뒤 서쪽 진입점에서 다시 출발한다.
- 경로에 걸리는 횡단보도 12곳에 정지선을 적용한다. 횡단 구역이나 양쪽 대기점에 보이는 참가자 또는 이벤트 NPC가 있으면 차량이 대기한다. 비어 있으면 다시 가속한다.
- 승차 이벤트의 택시는 간선의 버스 진행 공간을 확보하기 위해 기존 승차점 옆에서 연석 쪽으로 옮겨 두었다. 주행 차량의 위치는 각 Unity 클라이언트가 계산한다.
- `CityMasterplanV003LocalBuild.AuditTraffic`은 저장 씬의 차도 콜라이더 위에서 약 0.5m마다 차체 폭·길이와 주변 충돌을 확인하고, 버스 정차·재출발, 승용차 순환, 횡단보도 양보를 검사한다.

## 전시 UX 후속

현재 페이지는 대표 상황 테스트용이다. 정식 `/participate`에 수동 이벤트 컨트롤러·결과 모달·다중 상황 선정·상황 소진·마감/재접속 처리를 통합해야 한다. 나머지 29개 접근 경로·상호작용 반경·NPC·애니메이션·실내 출입·신호/정전/침수 토글은 배치표의 후속 작업을 따른다. 지역 경계와 오염 영향의 공간적 연결도 승인 전이다. 90초 목표, 개막 필수 상황 수, 도시 외형 변화·오염 확산·웹 푸시 필수 여부는 결정하지 않았다. 목표 모바일 기기 성능과 전시 최종 승인, 운영 배포는 후속 범위다.

## 편집 담당

| 담당 | 단독 편집 범위 |
|---|---|
| Unity | `CityMasterplanV003LocalBuild.cs`, 빌드 준비 스크립트, 경로 계약 JSON과 서버 사본, Unity 물리 검사·WebGL 산출물 |
| Blender·에셋 | 30행 배치표와 생성 스크립트, 자산 대조 보고서, manifest·catalog |
| 백엔드 | `web/src/lib/{city,npc,routes}`, 이벤트 API, `UnityCity.tsx`와 버전 검사, 관련 서버 테스트 |
| DB | `db/content/city-v003-local-draft.sql`, `scripts/dev/v003-local.mjs`, 격리 DB 실행 |
| Web UI | `web/src/app/v003-test/` |
| 독립 QA | QA 보고서와 독립 검증 스크립트 |
| 팀장 | 인계 문서, 변경 통합, 사용자 진입점 확인 |

기준 저장 씬은 Unity 담당의 읽기·파생 빌드 대상으로 사용한다. Blender 담당은 이 씬의 Transform을 읽어 자산과 대조한다. 로컬 테스트 산출물의 최종 검증 상태는 QA 기록에 갱신한다.
