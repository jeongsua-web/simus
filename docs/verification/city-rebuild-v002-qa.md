# City Rebuild v002 — Phase 1–3 독립 QA

사용자 요청에 따라 Phase 3까지 검토한다. Phase 4 공원 조경, Phase 5 NPC 네트워크, Phase 6 카메라·성능, Phase 7 최종 전시 검증은 이번 인도 범위 밖이다. 정적 검사와 Unity 실제 실행 증거를 구분한다.

## 근거

- 승인 `layout.json` SHA-256: `3e98ea485bd92dc9c2528d0420b5999a0336f700270c0f73f7630aa214fbd105`.
- [보호 기준선](city-rebuild-v002-protected-baseline.json): 작업 시작 시 995개 파일의 SHA-256. 생성된 Python 캐시 1개를 제외한 994개 기존 원본 씬·모델·메타·기존 코드·빌드 설정·웹·승인 설계 자료를 보호한다. Git HEAD가 작업 중 변경되더라도 이 기준선으로 비교한다.
- [독립 검사기](../../scripts/unity/check-city-rebuild-v002.py): 기존 v002 설계 QA의 convex SAT 함수 재사용, CSV 비교, 직렬화 local fileID와 외부 GUID 검사, 실행 보고의 실제 FBX 출처·bounds와 승인 배치 비교.
- [정적 검사 결과](city-rebuild-v002-static-results.json). 파일 존재·설계 승인·카탈로그 등재를 Unity Play Mode나 전시 승인으로 간주하지 않는다.

## 사전 확인 및 구현 리뷰

외부 건물 55개와 캠퍼스 14동의 CSV 위치·회전·실측 치수가 승인 layout과 일치하며 설계 envelope 충돌은 없다. 기존 FBX 및 메타가 존재한다. `map_version = null`, 이벤트 최대 대기 90초, 이벤트 로직 미변경 계약을 유지한다. 기존 2×2 v001 지도는 사용하지 않는다.

생성기 리뷰에서 R06/R07 회차 공간이 원형 `radius`가 아닌 사각형 `width/depth`인 점을 발견하여 Unity 담당자에게 수정 요청했다. 실제 가져온 FBX의 world bounds를 검사하고 캠퍼스의 분리 메시 출처를 보고에 남기도록 검토했다. 원본 `CompletedMapNpcFollow`를 복사하고 신규 생성 루트만 교체하는 흐름이며 빌드 목록을 변경하는 코드는 없다.

첫 Unity 생성 실행에서는 C# 컴파일과 539개 표면 생성까지 진행했지만 캠퍼스 창틀 메시의 원본 이름과 FBX 이름이 달라 `Campus component mesh missing ...WINDOW_FRAMES...` 예외로 중단했다. Blender 담당자의 실제 FBX 매칭표를 읽도록 수정한 뒤 재실행에 성공했다. 중단 시 남은 원본 복사 씬을 완성 도시로 판정하지 않도록 독립 검사에서 69개 건물 래퍼 ID와 17개 횡단 시설 루트를 별도로 센다.

[Blender FBX 실제 읽기 감사](city-rebuild-v002-blender-fbx-audit.json)는 14개 FBX를 읽고 원본 보존과 치수 편차 최대 0.000796 m를 확인했다. [출입구 근거표](city-rebuild-v002-external-entry-evidence.csv)에서 39개 외부 건물은 설계의 임시 local −Z 출입 가정과 문·경사로 메시 방향이 다른 후보로 식별되었다. 승인 배치·회전은 유지한다. 이 후보를 실제 문턱 접근 성공으로 판정하지 않으며 Unity에서 사용자 확인 후 보행 네트워크 구현 단계에서 해소해야 한다.

Unity 환경 재시도 `/tmp/simus-v002-phase1-retry.log`는 정상 종료와 C# 컴파일 로그를 남겼다. 단 기존 `TransitAssetSetup.OnPostprocessModel:15`에서 버스·택시 가져오기 중 `NullReferenceException` 2건이 발생했다. 전체 프로젝트 에셋 임포트가 무오류라는 뜻은 아니다. 이 기존 importer는 이번 작업에서 수정하지 않았다.

## 검증 상태

실제 Unity 생성·재로드와 [실행 결과 JSON](city-rebuild-v002-unity-results.json)의 SHA-256·배치 근거를 독립 확인했다. 표면 검사에서 발견한 접속면 누락과 지면 빈 부분을 수정한 최종 씬을 재검토했다. 최종 Unity 생성·물리 표면 검사·정적 렌더가 모두 exit 0이며, 독립 정적 검사 20항목도 통과했다.

| 항목 | 상태 | 근거·제한 |
|---|---|---|
| 승인 layout / CSV 일치 | PASS | 독립 Python 검사 |
| 설계 건물 envelope 충돌 없음 | PASS | 69개 SAT 계산; 실제 mesh 검증과 구분 |
| Unity 환경 실행 / 기존 C# 컴파일 | PASS | phase1 retry 정상 종료; 신규 생성기 실행은 별도 확인 |
| 신규 Unity 생성기 컴파일 | PASS | 최초 Build 실행에서 Editor Csc 성공 후 생성 함수 진입 |
| 씬 정상 저장·재로드 | PASS | Unity 저장 후 다시 열기 성공; 실행 보고와 씬 해시 일치 |
| 실제 FBX 14+55 배치 | PASS | 69개 ID, 실제 FBX GUID, world bounds·배율·yaw 독립 확인 |
| 도로 실제 표면 지지 샘플 | PASS | 실제 Unity mesh 버퍼 검사 4,938개 샘플 지지 |
| 보행 실제 표면 지지 샘플 | PASS | 최종 31,512개 지지. 실제 거리 1mm 경계 허용오차; 7개 끝단 샘플이 허용오차 사용 |
| Unity 실제 Collider 지지 | PASS | 409구간 10,517개 중심선 raycast, 누락 0·건물 hit 0 |
| 실제 건물 간 envelope 충돌·접지 | PASS | 69개 실제 Unity Renderer bounds, XZ 및 Y=0/height, 충돌 0건. 메시 내부 문턱 통행과 구분 |
| 실제 출입문 방향·문턱 접근 | NOT TESTED | 계획 접근점과 문 메시 검증은 별개 |
| 로컬 NPC 구간 지지 | PASS | Unity 하향 ray 21개. 실제 NPC 몸체/애니메이션 검증과 구분 |
| NPC 이동 / 기존 기능 | NOT TESTED | Play Mode 미실행. 최종 정적 캡처는 기존 NEUTRAL_WALK 0.5초를 수동 샘플링해 직립 자세 확인 |
| 추적 카메라·아이소메트릭 가독성 | NOT TESTED | Phase 6 범위 |
| NavMesh·388/409 그래프 런타임 연결 | NOT TESTED | Phase 5 범위 |
| 1 / 100 / 500 / 1,000명 성능 | NOT TESTED | 실제 벤치마크 미실행 |
| 원본 씬·빌드 설정 보존 | PASS | 생성기 byte 비교 및 독립 baseline 일치. 자동 변경된 모델 meta도 최초 SHA-256와 일치하게 복원 완료 |
| 카탈로그 검사 | FAIL | 최종 생성 64건·검사 65건으로 각각 exit 1. 기존 source 경로 누락·해시 불일치·inventory stale 포함 |

## 보호 대상 및 미실행 범위

기준선 이후 설계 `README.md` 변경은 조정 담당자가 사용자 승인과 구현 시작을 기록한 의도된 문서 변경이다. 검사기의 명시적 예외로 기록하고 layout·CSV와 원본은 계속 보호한다. Unity가 원본 university_v003 `.blend.meta`에 importer 설정을 자동 추가한 변경을 발견해 조정 담당자에게 전달했다. 최종 검사에서 원본 바이트 복원을 확인했다. Unity가 새로 만든 SceneTemplateSettings.json은 /tmp로 보관하여 기존 프로젝트 설정에 추가하지 않았다. 에셋 catalog README에는 새 씬의 사용처를 문서화했으며 이 문서 변경도 명시적 예외로 기록했다.

백엔드·DB·웹을 변경하지 않으므로 웹 lint, typecheck, DB 통합검사 및 브리지 런타임 검사는 실행하지 않았다. QA는 독립 Unity 프로세스를 시작하지 않고 조정 담당자가 실행한 로그와 씬 결과를 검토한다. 불필요한 원본 수정이나 manifest 승인 승격을 하지 않는다.

## 최종 표면·이미지 확인

[표면 정적 검사](city-rebuild-v002-surface-results.json)는 실제 직렬화 메시의 삼각형 버퍼를 읽고 도로 4,938개·보행 31,512개 샘플을 검사했다. 최초 136개 누락은 crossing으로 분류된 경로 전체를 건너뛴 구현에서 발생했고, 차도 밖 잔여 부분을 보도 높이로 생성하여 수정했다. 끝단의 1mm 미만 구간은 월드 좌표 부동소수점 계산과 삼각형 경계 오차가 있어 면적 계산을 double로 보완하고, 검사에 실제 거리 1mm 허용오차를 적용했다. 허용오차 사용 7개 샘플은 결과 JSON에 별도 기록한다. 이는 연속적인 유한반경 NPC 경로/단차/NavMesh 통과 증명이 아니다.

[Unity 물리 검사](city-rebuild-v002-surface-audit.json)는 같은 최종 씬에 실제 raycast 10,517개를 실행하여 모든 중심선의 생성 도로/보도 지지와 건물 hit 0을 확인했다. 최종 로그는 `/tmp/simus-v002-build-verified.log`, `/tmp/simus-v002-surface-verified.log`, `/tmp/simus-v002-capture-verified.log`다.

조정 담당자가 최종 탑뷰와 NPC 정적 캡처를 직접 확인했다. 캠퍼스 북동쪽 파란 지면 구멍은 제거됐고 기존 애니메이션 수동 샘플 후 NPC가 직립한다. 전체·탑뷰·NPC 이미지 출력은 Unity Editor 렌더 성공이며 동적 추적·Play Mode 검증은 NOT TESTED로 유지한다.
