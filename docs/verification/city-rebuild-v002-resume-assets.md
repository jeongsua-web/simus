# CityRebuild_v002 재개 — Blender/FBX 확인 및 출입구 인계

2026-10-16. 도시 배치 기준은 승인된 `docs/planning/city_rebuild_v002/layout.json`이다. 이 문서는 기존 Blender 조사·실제 FBX import 결과를 재사용하고 현재 파일 해시를 대조한 기록이다. 원본 `.blend`, FBX, `.meta`, GUID, 건물 배치, 원본 씬은 변경하지 않았다. Unity 실행 결과는 Unity 담당자의 이번 재실행 보고서에서 확인한다.

## 건물·공원 재사용

- [Phase 1–3 실제 FBX 감사](city-rebuild-v002-blender-fbx-audit.json)의 14개 FBX와 대응 원본 14개는 현재 SHA-256가 당시 감사 값과 모두 같다. 이 14종은 Campus 1종과 외부 건물 13종이며, 캠퍼스 14동/외부 55동의 재사용 원본이다. 이번에는 FBX를 Blender에 다시 가져오거나 내보내지 않았다.
- Campus 487개 실제 메시 중 건물별 308개를 14동으로 조립할 수 있다. [이름·축 매핑](city-rebuild-v002-campus-fbx-map.json)과 [실제 Unity importer 결과](city-rebuild-v002-campus-unity-import.json)를 재사용한다. 최초 도시 축 계약은 `(B.X, B.Z−0.18, B.Y+65)`이며 이후 승인된 건물별 delta를 적용한다. importer 원점을 건물 중심으로 오인하지 않는다.
- [Phase 4 FBX 메타데이터](city-rebuild-v002-phase4-fbx-metadata.json)의 공원·나무·벤치 6개 FBX도 현재 해시가 모두 같다. 공원 2종은 각각 하나로 합쳐진 실제 메시이므로 내부 나무/벤치를 renderer 이름으로 개별 선택할 수 없다. 모듈 내부 동선은 연결 성분 추출 또는 실제 충돌 검사 결과를 따라야 한다.
- 공원 PM1은 12×12m, `(140,25)`에 scale=1이며 PM2도 12×12m, `(142,118)`에 scale=1이다. 도시 전체 공원 크기로 확대하지 않는다. 운동장·농구장·테니스장은 기존 Campus FBX 메시를 재사용할 수 있다. 현장 배치/물리/화면 검증은 Unity 실행의 몫이다.
- STREET_TREE/REUSED_BENCH의 native 모델 회전은 약 `(90,0,180)`이다. 이를 yaw-only 회전으로 덮어쓰면 나무가 눕는다. 기존 importer 회전·scale을 별도 wrapper 안에 보존하고 world bounds로 다시 grounding한다. 정상 높이의 비교값은 나무 약 4.7544m, 벤치 약 0.9725m다. 원본 재수출로 해결할 문제가 아니다.

상세 조사와 기존 시설 FBX 참조는 [Phase 4 에셋 기록](city-rebuild-v002-phase4-assets.md)에 있다. 파일 존재, import 성공, received 등록을 전시 승인으로 취급하지 않는다.

## 실제 문앞 geometry 증거

[읽기 전용 조사 코드](../../scripts/assets/audit_city_rebuild_v002_portals.py)와 [출입구 source face 증거](city-rebuild-v002-portal-source-evidence.json)를 인계한다. JSON은 Blender 5.2.2 LTS에서 읽은 외부 13종의 후보 mesh 354개, polygon face 6,256개의 world 정점·normal·bounds를 포함한다. 이번 재검사에서 13개 source 모두 JSON의 읽기 전후 해시와 현재 해시가 같고 승인 측정 hash와도 일치했다. 코드는 open/read/JSON 기록만 하며 Blender save/export 연산이 없다.

후보 수집은 이름에 `entry/entrance/door/ramp/step/accessible/glass/glaz/leaf/frame`이 있는 저층 메시를 넓게 모은다. 따라서 창문 프레임·조명·차량 진입부 등도 포함되며 JSON의 모든 객체가 문인 것은 아니다. 또한 이름 필터에 걸리지 않는 실제 문 요소는 빠질 수 있다. 객체 이름만으로 확정 portal을 만들지 않는다. `area_local`은 원본 로컬 면적이며 변환 후 world 면적으로 해석하지 않는다.

- 주택 3종은 `Entry_Ramp`/`Entrance_Ramp`와 canopy가 +Blender.Y 쪽에 있다. 빌라 3종의 `Accessible_Entry`는 +Blender.X 쪽이며 VILLA_03은 −Y 모서리다. 램프 중심은 문 중심이나 outward normal의 확정값이 아니다.
- 아파트 A는 `Core_Front_L1_Entry_Glass`의 X≈4.16 plane과 apron/canopy가 +X 방향 증거다. 아파트 B/C의 명명된 Entry_Glass는 각각 Y≈−5.48/−8.88이다. 실제 문틀·glass와 외부 apron 사이를 변환 후 확인한다.
- 상가는 남측 DoorPull/문틀과 북측 Service_Door가 동시에 있다. 손잡이 좌표만 선택하면 양쪽 문 또는 좌우 문 중심을 혼동할 수 있다. 남측 상가02 ramp는 X≈−6.825, 상가03 ramp는 모서리 방향이므로 모든 상가에 공통 남측 중앙 connector를 적용하지 않는다.
- 백화점은 `main entrance glass`, door handles, lower/upper step이 별도다. lower step 높이 0.075–0.225m와 upper step 0.26–0.46m를 같은 평면으로 취급하지 않는다. 유리 중심은 NPC 발 높이가 아니다.

이 증거와 [55개 후보 CSV](city-rebuild-v002-external-entry-evidence.csv), [독립 접근 검토](city-rebuild-v002-entry-access-review.md)를 Unity 담당자에게 공유했다. 승인 그래프 388 nodes/409 edges와 건물 배치/yaw를 유지하고 구현 전용 exterior connector를 별도로 추가할 수 있다. 다만 변환된 실제 geometry에 대한 support, body-width clearance, 문 앞 지지 높이 확인이 필요하다. proxy 도달이나 broad ground raycast만으로 실제 문 접근 PASS를 부여하지 않는다. NavMesh bake/접합은 별도 검증이다.

## 카탈로그 source hash 4행 동기화

메인 담당자의 명시적 위임으로 `assets/manifest.csv`의 기존 `source_sha256` 셀 네 개만 현재 HEAD 원본 해시에 동기화했다. **3개 실제 원본 파일이 네 개 논리 에셋에서 참조되는 경우**다. 실제 원본 바이트는 모두 HEAD와 같으며 이번 조사에서 바뀌지 않았다. 나머지 manifest 내용, received 상태, 교환 FBX 해시, 에셋 키는 보존했다.

| 에셋 키 | 기존 source hash의 Git blob | 현재 source hash의 Git blob |
|---|---|---|
| modular_character_happiness_animations_v001 | `f89baec`, `288f9b6331b2cb6488a8755c6975520b35015adab8e26fad2287a61f7df273bd` | `9780eb3` (애니메이션 오류 수정), `c7ca09cb7b2a70fcea347efe602b39fc152f1a757b57ea4eafb3c38a7ea75506` |
| crying_child_v001 | `4669f64`, `f95d8cd6800d27f907aef0617114808250739bf599f8034eb9d7f2655c2ac7a9` | `4d51f97`, `14cf832ab3986058c0671cbdc7eb2fba23915d0e6f913e6ea82314fec819fd99` |
| heavy_carrier_v001 | `4d51f97`, `61ad6c86af6760a68871f4c2bf7e517880ec5c8a94c1d052a3e0602d3265c737` | `e254692`, `1512965fcffa244100e9dc08435201da51953cd17c65208fd3e549d3e4df4bad` |
| heavy_box_v001 | 위 HeavyCarrier와 같은 원본 | 위 HeavyCarrier와 같은 원본 |

각 값은 현재 파일 SHA-256 및 `git show <commit>:<path>`의 바이트 SHA-256으로 대조했다. 원본 후속 수정 뒤 manifest 값이 뒤따르지 않은 이력으로 설명된다. 이는 **현재 원본/FBX가 재수출상 동기화됐다는 검증이 아니다**. 원본과 교환 FBX의 모델·리그·애니메이션 동기성 재검사는 NOT TESTED이며 received를 approved로 올리지 않았다. 카탈로그 생성과 `--check`는 동시 쓰기를 피하도록 메인 담당자가 최종 통합 시 실행한다.

추가로 승인 측정 29개 전체를 대조하면 과거 통합 대학맵 `SIMUS_Dense_Realistic_University_Map_03`의 원본·FBX 해시는 오래된 설계 측정과 다르다. v002 건물 재사용 14종은 위와 같이 모두 일치하며, 과거 통합맵의 변경을 v002 배치 근거로 끌어오거나 측정 JSON을 갱신하지 않았다.

## 담당 검증 판정

| 항목 | 판정 | 범위 |
|---|---|---|
| 건물 FBX 14종/대응 원본 14개 기존 감사 hash 유지 | PASS | 현재 파일 바이트 대조 |
| 공원·나무·벤치 FBX 6개 기존 감사 hash 유지 | PASS | 현재 파일 바이트 대조 |
| 외부 13종 후보 source geometry와 보존 hash | PASS | 354개 후보/6,256개 face 및 현재 source 대조 |
| source hash 4행의 수정 provenance | PASS | 현재 HEAD 및 과거 commit 바이트 대조 |
| Unity 최종 69동 배치/실제 문앞 도달/충돌체 | NOT TESTED by this audit | Unity 실행 및 QA 보고서 필요 |
| source↔FBX 후속 수정 동기성 | NOT TESTED | 재수출/리그 비교 미실행 |
| NavMesh 접합/1,000명 성능/전시 승인 | NOT TESTED by this audit | 별도 실제 실행 필요 |

새 Blender 파생본 제작이나 원본 수정은 필요하지 않았다. 신규 geometry evidence와 문서는 구현을 위한 입력이며 실제 Unity 실행 성공을 대신하지 않는다.
