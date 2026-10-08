# 4~8단계 개발 사본 통합

기준일: 2026-09-29. 실행 기준은 **Next.js + PostgreSQL + unity/** 이다.
Python API/프록시를 추가 실행하지 않는다. 원본 개발 사본은 2026-10-08 삭제했으며 Git 이력에 남아 있다. 본 프로젝트의 원본 맵 장면은 유지한다.

이 문서의 기능 표와 검증 범위는 통합 당시 기록이다. 현재 DB 적용 순서는 [DB 안내](../../db/README.md), 추가된 기능과 인수 범위는 [루트 README](../../README.md)를 따른다.

## 통합한 기능

| 원본 기능 | 통합 위치·동작 |
|---|---|
| 모바일 도시 수치 | `/participate`에서 본 서버 `/api/city-state` 조회. 다른 회차 수치는 표시하지 않음 |
| 제출 정보 복원 | 선택 전 원래 회차·상황·선택·요청 키를 localStorage에 저장. 새로고침·회차 변경 후에도 원래 요청으로 재확인 |
| 과거 결과 | 인증된 `/api/participants`의 본인 history와 `/result/{id}` 링크 |
| 최종 도시 | 결과 API의 해당 회차 확정 스냅샷 표시. 현재 회차 도시와 구분 |
| 회차 길이·영향 배율·다음 회차 | JWT 관리자 화면에서 DRAFT/FINALIZED 콘텐츠 복사 → DRAFT 준비 → 기존 시작 API. 진행 시간은 실제 시작 기준 |
| 맵·NPC 미리보기·임시 도시 연출 | `unity/Assets/Scenes/NeighborhoodLive.unity`, `NeighborhoodLife`. 본 서버 폴러와 HUD 재사용 |
| 회차·버전·최종 상태 보호 | 이전 회차 재수신·버전 감소·CLOSING→RUNNING·FINALIZED 변경 차단. DB 복구 때만 명시적 Reset |
| 실제 시제품 테스트 콘텐츠 | `db/seed_neighborhood.sql`: 원본 PostgreSQL 서버의 WASTE 상황/선택지/점수. 시연 DB에 선택 적용 |

본 저장소의 JWT 관리자 인증, HttpOnly 참여자 쿠키, 트랜잭션과 DRAIN 종료 정책을 유지한다.
원본의 공용 관리자 키나 별도 `simus_visitor` 쿠키를 새 서비스 인증으로 사용하지 않는다.
데이터 이관은 실행하지 않았다. 별도 Python DB의 기존 참여 기록을 자동 합치지 않으며, 기존 본 DB를 변경하지 않았다.

## 실행

1. 새 DB는 `001_initial_schema.sql`부터 `009_participant_profiles.sql`까지 번호 순서대로 적용한다. 기존 DB는 적용 이력을 확인하고 누락된 후속 마이그레이션만 순서대로 적용한다.
2. 새 개발/시연 DB는 `db/seed_demo.sql` 또는 `db/seed_neighborhood.sql`로 최초 DRAFT 콘텐츠를 준비한다. 전시 30상황 초안은 demo seed 다음에 `db/seed_exhibition.sql`을 선택 적용한다. 운영 DB에는 시드를 실행하지 않는다.
3. `web/`의 환경 설정을 준비하고 `npm ci`, `npm run build`, `npm start`를 실행한다. 관리자 JWT 설정은 기존 `docs/operations/demo-deployment.md`를 따른다.
4. `/admin`에서 인증한다. 기존 준비 회차를 시작하거나, 복사할 회차·이름·진행 시간·배율을 설정해 새 회차를 준비한 뒤 시작한다.
5. Unity 6000.3.24f1로 `unity/`를 열고 `Assets/Scenes/NeighborhoodLive.unity`를 실행한다. `SIMUS Connected Neighborhood`의 CityStatePoller Server Base Url을 웹 서버 주소로 설정한다. 기본값은 `http://localhost:3000`이다.
6. `/participate`에서 선택하고 Unity 도시 수치·임시 연출을 확인한다. 종료 후 `/result/{id}`에서 개인 결과와 해당 회차 최종 도시 수치를 확인한다.

Unity 장면 재생성: `SIMUS > Build Connected Neighborhood`. 원본 `Neighborhood.unity`에서 파생 장면을 만들며 원본을 덮어쓰지 않는다. 파생 장면을 직접 편집했다면 재생성 전에 별도로 보관한다.

Compose는 **새 볼륨에 001~009를 적용**한다. 이미 생성된 볼륨에는 새 SQL이 자동 적용되지 않으므로 적용 이력을 확인한 뒤 누락된 후속 마이그레이션을 별도 적용한다. 볼륨을 삭제해서 마이그레이션하지 않는다.

자동 종료는 기존 인증된 reconcile API를 호출하는 스케줄러가 필요하다. Python 서버의 tick 루프를 운영용으로 함께 실행하지 않는다.

## 새 API 계약

`POST /api/admin/sessions` — 관리자 Bearer JWT, 동일 출처 검증.

```json
{
  "template_session_id": "기존 DRAFT 또는 FINALIZED 회차 UUID",
  "name": "다음 도시의 하루",
  "duration_seconds": 300,
  "impact_scale": 0.1,
  "request_key": "요청마다 생성한 UUID"
}
```

최초 201, 동일 요청 재전송 200. `{session_id,status,replayed}` 반환. 같은 키의 다른 설정은 409.
이름 1~120자, 시간 10~86400초 및 원본 접수 버퍼 초과, 배율 0~1·소수점 10자리 이내.
지역·상황·선택지·영향값·초기 규칙만 복사한다. 선택 원장·참여자·결과·현재 도시 상태는 복사하지 않는다.
시작 및 종료는 기존 `/api/admin/sessions/{id}/start|end`를 사용한다. 동시에 실행하는 회차는 하나다.

`GET /api/participants`는 기존 `latest_session`과 본인의 FINALIZED 회차 `history`를 반환한다.
`GET /api/sessions/{id}/result`는 기존 `result`와 해당 회차 `city_state`를 반환한다. 종료 전에는 기존대로 409다.
Unity 공개 API는 `/api/city-state`이며 버전은 bigint 정밀도를 보존하는 문자열이다.

## 남은 프로젝트 범위

통합 당시 미리보기 NPC는 실제 참여자와 연결되지 않았고, 학과·통계와 본인 NPC 모바일 추적은 후속 범위였다. 현재는 해당 기능의 코드가 추가됐으며 실기기 인수 범위는 [3B 기록](../contracts/participant-npc-display-3b.md)과 [학과 통계 기록](../contracts/department-statistics.md)을 따른다.
웹 푸시 코드는 추가됐으며 실제 기기 수신과 운영 설정은 [4B 기록](../contracts/result-notification-4b.md)의 남은 인수 범위다. 최종 도시 이미지·캐릭터와 오염 확산은 후속 범위다.
`prototype/content.py`의 추가 상황은 legacy 예시이며 실제 PostgreSQL 시제품은 WASTE 1개를 사용했다.
따라서 검증되지 않은 나머지 콘텐츠를 운영 데이터로 자동 등록하지 않았다.
실제 장비·LAN·QR·배포·Windows/WebGL 빌드는 별도 완료 조건이다.

검증 기록: [통합 검증 결과](../verification/stage4-8-validation.md).
