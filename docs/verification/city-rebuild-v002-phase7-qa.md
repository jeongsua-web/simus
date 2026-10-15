# City Rebuild v002 — Phase 4–7 독립 QA

진행 중. 최종 Unity 실행 결과를 대조하기 전인 기준선 보고이며, 아래 초기 실패는 Phase 3 결과물에서 재현한 사항이다. 정적 검사 결과를 Unity 실행 성공으로 표현하지 않는다.

## 기준선과 보호 범위

- 작업 시작 당시 2,131개 파일 해시와 기존 Git 변경 상태를 [Phase 4–7 기준선](city-rebuild-v002-phase47-baseline.json)에 기록했다. 기존 변경을 되돌리지 않았다.
- 승인 `layout.json` SHA-256: `3e98ea485bd92dc9c2528d0420b5999a0336f700270c0f73f7630aa214fbd105`.
- 기존 원본 씬, `.blend`/FBX/메타, 승인 JSON/CSV, 빌드 설정, NPC 이벤트 및 웹 코드는 보호한다. 작업 씬·생성 지형·생성기와 사용자가 허용한 카메라 조정은 별도 변경 검토 대상이다.
- [Phase 4–7 독립 검사기](../../scripts/unity/check-city-rebuild-v002-phase47.py)는 기존 표면 검사기의 실제 직렬화 삼각형 reader를 재사용한다. [정적 결과](city-rebuild-v002-phase47-static-results.json)의 PASS는 해당 정적 조건만 뜻한다.

## 초기 재현

- 흰 선은 기존 생성기의 `04_PedestrianSurfaces`에 생성된 실제 메시와 MeshCollider다. 그래프 Gizmo만 표시한 것이 아니다. 도로와의 겹침을 제거하고 그래프 폭대로 생성하므로 색·표면 개선 시 그래프와 면 지지를 재검사해야 한다.
- 500 units 경고 후보를 실제 직렬화 버퍼에서 재현했다. `meshes/surface_0000.asset`의 CityGround 삼각형 2개의 최대 변 길이는 **627.293392 m**다. Unity 담당자에게 전달했다. 최종 subdivision 뒤의 buffer 검사와 실제 Unity 경고 로그 검토가 필요하다.
- 현재 연결된 승인 그래프는 388 nodes / 409 edges, 횡단 시설 17개다. 설계 그래프 연결성만 확인했으며 실제 NPC 이동을 증명하지 않는다.
- 이전 QA에서 외부 건물 39개 출입 방향 후보 불일치를 기록했다. 주요 구역 사이 이동과 실제 문턱까지의 접근성은 별개로 검증한다.

## 최종 판정 대기

| 항목 | 상태 | 현재 근거·제한 |
|---|---|---|
| Unity 컴파일 / 씬 정상 로드 | NOT TESTED | Phase 4–7 최종 실행 증거 대기 |
| 실제 FBX 캠퍼스 14동 / 외부 건물 55개 | NOT TESTED | 기존 결과와 직렬화 69개 wrapper 확인, 최종 실행 대기 |
| 공원 모듈 2개 / 녹지 | NOT TESTED | 구현 후 최종 실행 대기 |
| 도로 / 보행로 연결 | NOT TESTED | 승인 그래프 연결성 정적 PASS, 최종 물리 검사 대기 |
| 건물 충돌 없음 | NOT TESTED | 최종 실제 geometry 결과 대기 |
| NPC 지면 위치 / 구역 간 이동 | NOT TESTED | Play Mode 이동 결과 대기 |
| 카메라 추적 / 아이소메트릭 가독성 | NOT TESTED | 실제 Game 뷰 캡처와 동적 측정 대기 |
| 500 units 초과 삼각형 경고 해결 | FAIL | 초기 CityGround 두 삼각형 627.293392 m 재현; 수정 후 재검사 예정 |
| 원본 씬 / 빌드 설정 / 이벤트 / 웹 보존 | PASS | 초기 기준선과 현재 파일 비교; 최종 재검사 예정 |
| 기존 NPC 기능 유지 | NOT TESTED | 기존 코드 보호와 실제 애니메이션/이동 호환은 별개 |
| 실제 문턱 접근 / NavMesh | NOT TESTED | 최종 검증 범위와 결과 대기 |
| 1 / 100 / 500 / 1,000명 성능 | NOT TESTED | FPS·CPU·메모리 실제 측정 대기 |
| 카탈로그 검사 | NOT TESTED | 기존 카탈로그 오류 존재; 최종 생성·검사 결과 대기 |

QA 담당자는 별도 Unity 프로세스를 띄우지 않고 조정 담당자의 실제 실행 로그와 해시가 일치하는 결과를 독립 검토한다. 웹·백엔드 변경이 없어 웹 lint/typecheck/DB 통합검사는 범위 밖이며 실행하지 않는다. 카탈로그 등재를 전시 승인으로 간주하지 않는다.
