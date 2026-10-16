# v002 Windows 재개 독립 QA

2026-10-16. 라이선스 갱신 후 실행 재개에 대한 독립 검토다. Unity 실행은 Unity 담당이 수행하며, 이 검토자는 검사 스크립트와 검증 산출물을 담당한다. 이 문서의 정적 PASS는 Unity Play Mode 성공을 의미하지 않는다.

## 재사용 검사와 Windows 수정

`scripts/unity/check-city-rebuild-v002*.py`의 UTF-8 읽기/쓰기, Git 경로 구분자, 상대 `--scene` 경로 처리를 수정했다. surface 검사에 `--output`을 추가해 이전 결과를 보존했다. river 검사의 `/tmp/simus-river-baseline-20261015/CityRebuild_v002.unity`는 이 Windows 환경에 없으므로 해당 백업에 의존하는 두 보존 검사를 NOT TESTED로 기록하고 나머지 검사를 계속한다. 없는 백업을 현재 씬으로 대체하지 않았다.

실행한 명령은 다음과 같다. Windows의 실제 Python 3.11 인터프리터인 `python`을 사용했다.

```text
python scripts/unity/check-city-rebuild-v002.py --scene unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity --output docs/verification/city-rebuild-v002-resume-base-static-results.json
python scripts/unity/check-city-rebuild-v002-phase47.py --output docs/verification/city-rebuild-v002-resume-static-results.json
python scripts/unity/check-city-rebuild-v002-surfaces.py --output docs/verification/city-rebuild-v002-resume-surface-results.json
python scripts/unity/check-city-rebuild-v002-river.py --output docs/verification/city-rebuild-v002-resume-river-static-results.json
```

## 정적 결과

| 검사 | 상태 | 증거/범위 |
|---|---|---|
| 승인 v002 JSON과 CSV 배치 일치 | PASS | 캠퍼스 14동 + 외부 55동 |
| 69동 실제 FBX 참조 | PASS | 이름만 검사하지 않고 하위 Transform/Mesh/Prefab의 원본 GUID를 추적 |
| 69동 기존 건물 hierarchy 보존 | PASS | continuation baseline Git commit의 직렬화 내용과 비교 |
| 공원 모듈 2개 실제 FBX 참조 | PASS | 승인 layout의 두 FBX 경로 일치 |
| 씬 local 참조와 external GUID | PASS | 누락/중복 없음 |
| 승인 보행 그래프 연결 | PASS | 388 nodes / 409 edges / 17 crossings; runtime과 별개 |
| 승인 건물 envelope 충돌 | PASS | 설계 envelope 검사; 최신 Unity imported bounds는 별도 |
| 도로/보행면 지지 샘플 | PASS | 도로 4,938, 보행 31,512 샘플에서 미지원 0; 생성 triangle 기준 |
| 강변/교량 현재 직렬화 형상 | PASS | 원래 409개 경로 보존, 물 횡단 교량 지지, 경사/폭 샘플 |
| 구 river 임시 백업 대비 건물·도로 보존 | NOT TESTED | 과거 `/tmp` 백업 부재 |
| historical raw 보존 해시 전체 일치 | FAIL | Windows CRLF 및 과거 생성물 부재 등을 그대로 기록 |
| 구 Phase 1–3 Unity evidence의 현재 raw 입력 일치 | FAIL | 구 보고서의 scene/layout/generator 해시가 현재 파일과 다름; 재실행 증거로 취급하지 않음 |

상세 결과는 [base](city-rebuild-v002-resume-base-static-results.json), [phase47](city-rebuild-v002-resume-static-results.json), [surface](city-rebuild-v002-resume-surface-results.json), [river](city-rebuild-v002-resume-river-static-results.json)에 있다.

## raw SHA와 줄바꿈 정규화

[별도 보존 증거](city-rebuild-v002-resume-preservation.json)는 raw SHA와 CRLF→LF 정규화 SHA를 분리한다. 승인 layout의 raw SHA는 `e668ce0563fcdee037d0a5f2fae53f47cbc6865b7f4534d29c8c9e342d0b0569`, LF SHA는 승인값 `3e98ea485bd92dc9c2528d0420b5999a0336f700270c0f73f7630aa214fbd105`와 같다. 승인 설계 내용은 일치하며 raw byte 일치는 아니다.

continuation baseline 2,180개 중 545개 raw 일치, 1,588개 LF 정규화 시 일치, 7개 기타 변경, 40개 부재가 확인됐다. 기타 변경·부재의 전체 경로와 해시는 별도 증거에 남겼다. 부재 항목은 이전 환경의 로컬 web 설정·빌드/백업 산출물 등이며, 존재하지 않는 파일을 보존 PASS로 바꾸지 않았다. 원본 씬 3개 및 EditorBuildSettings는 현재 Git HEAD와 LF 정규화 내용이 모두 일치한다. 런타임 입력 freshness 검사에는 줄바꿈 정규화를 적용하지 않는다.

## 범위와 잔여 검증

manifest 수정은 4행의 원본 SHA 동기화이며 경로·FBX SHA·승인 상태는 불변이다. 카탈로그 성공만으로 전시 승인을 부여하지 않는다. 백엔드/DB/web 기능 코드는 QA 범위에서 수정하지 않았고 해당 통합 테스트도 실행하지 않았다.

실제 69동 출입문/문턱 접근, NavMesh bake와 문 접합, Player/WebGL 성능, 실사용 이벤트/군중 회피 workload는 현재 정적 검사로 검증되지 않는다. 90초 최대 대기와 기존 이벤트 발생 로직은 변경 대상이 아니다. 최신 Unity 실행·캡처·입력 해시 검토 결과는 실행 종료 후 아래에 추가한다.
