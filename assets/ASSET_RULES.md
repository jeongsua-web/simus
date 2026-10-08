# SIM:US 에셋 정리 규칙

Codex·Claude 및 사람이 에셋을 추가·수정·이동·정리할 때 먼저 읽는 기준 문서다.
프로젝트 루트 `AGENTS.md`의 새 전시 맵 결정이 우선한다.

## 1. 무엇을 기준으로 찾는가

- `assets/manifest.csv`: 논리 에셋의 안정적인 `asset_key`, 납품 상태, 기준 원본·교환본, 해시를 관리한다. 승인 여부는 이 목록에서만 관리한다.
- `assets/catalog/inventory.json`: 실제 파일 전체의 경로·역할·크기·해시와 동일 내용 그룹이다. 스크립트로 생성하며 직접 편집하지 않는다. 여기에 존재한다고 채택·승인된 것은 아니다.
- `assets/catalog/README.md`: 사람이 탐색하는 시작점과 현재 Unity 사용처다.
- 납품물에 들어 있던 `Asset_Index.*`, `asset_manifest.jsonl`, `validation.json` 등은 제작 당시 참고 자료다. 외부 PC의 절대경로와 제작자의 검증 주장을 현재 프로젝트 사실로 사용하지 않는다.

## 2. 저장 구조

```text
assets/
  incoming/                         # 신규 접수, 분류 전 (필요할 때 생성)
  library/<category>/<asset_key>/
    source/                         # .blend 등 편집 원본
    exports/                        # .glb, .fbx 등 교환본
    previews/                       # 미리보기·평면도
    reports/                        # 제작 검증 자료
    textures/                       # 원본/교환본이 참조하는 이미지, 필요 시
    README.md                       # 파일 링크, 용도와 주의사항
    사용안내.md                     # 기존 제작 안내 원문
  archive/
    packages/                       # 받은 ZIP 원본
    backups/<asset_key>/            # .blend1 등 자동 백업
  catalog/                          # 전체 목록과 이동 이력
unity/Assets/SIMUS/
  Art/                              # 신규 Unity용 모델·재질·텍스처
  Prefabs/                          # 신규 배치용 프리팹
  Scenes/                           # 신규 장면
web/public/                         # 웹이 실제 배포하는 파일만
```

카테고리는 `maps`, `buildings`, `roads`, `props`, `vegetation`, `characters`, `ui`, `audio`를 사용한다. 혼합 제작 묶음은 주 용도의 카테고리에 두고 개별 원본을 복제하지 않는다. 예: `street_landscape`는 식생과 가로 시설물이 함께 있는 하나의 제작 묶음이다.

파일이 없는 폴더는 미리 만들 필요 없다. `.blend` 원본과 런타임 교환본은 용도가 다른 파일이며 중복이 아니다. 텍스처는 상대경로를 유지해 함께 이동하고, 미리보기로 오인해 분리하지 않는다. 참조 여부가 불명확하면 묶음 내부 배치를 유지한다.

## 3. Unity 에셋 배치와 기존 원본 예외

2026-10-08 후속 정리로 `SIMUS_Completed_Map_And_Assets` 묶음을 해체했다.

- 맵은 `unity/Assets/SIMUS/Art/maps/university_v003/`에 둔다.
- 건물·도로·소품·식생·캐릭터는 `SIMUS/Art/{buildings,roads,props,vegetation,characters}/`로 나눈다.
- 추적 테스트는 `unity/Assets/SIMUS/Scenes/npc_follow_test/`다. 편집기 코드와 빌드 설정도 이 경로를 사용한다.
- Unity 캐릭터는 `modular_hairfix_v001`만 유지한다. 현재 추적 테스트는 HairFix의 `models/`를 사용한다. `npc_16`, `modular_v001`의 Unity 사본은 2026-10-08 사용자 요청으로 삭제했으며 Git 이력에서 복원한다.
- 미리보기·보고서는 `assets/library/characters/<key>/`와 `assets/library/maps/university_v003/`에 둔다. 백업은 `assets/archive/backups/`, 중첩 프로젝트 자료는 `assets/archive/nested_projects/`에 보관한다.
- 기존 묶음의 `.blend`는 현재 FBX와 함께 둔다. 원본의 외부 참조와 Unity GUID를 보존하기 위한 예외이며, library에 원본을 복제하지 않는다. 신규 자산은 2절 구조를 따른다.
- `unity/Assets/department_store_v2/`와 이전 시제품 `Art/Neighborhood.fbx`, `Materials/`, `Scenes/Neighborhood*.unity`는 이번 요청 범위 밖이므로 기존 경로를 유지한다.
- 기존 Scripts/Shaders/Editor 코드는 에셋 분류만을 위해 이동하지 않는다.

앞으로 Unity 이동은 실행 중인 편집기 확인 → 사용처 조사 → 원본/폴더와 `.meta` 함께 이동 → 코드·빌드 설정·문서 갱신 → 재가져오기와 장면 검증 순서를 따른다. 잠금 파일 존재만으로 실행 중이라고 단정하지 않는다. `.meta` 재생성이나 GUID 변경으로 정리하지 않는다. Resources/StreamingAssets/Addressables의 경로 계약도 확인한다.

`Art/environment/`는 이전 그룹 폴더 GUID 보존용 빈 그룹이다. 실제 모델은 위 분류별 폴더에서 찾는다. 공급자 문서 안의 이전 이름·절대경로는 당시 기록이며 현재 경로는 catalog와 이동 이력을 따른다.

## 4. 이름·버전·상태

- 신규 폴더/식별자는 영문 소문자와 `_`를 사용한다. 기존 `asset_key` 및 API 성향 코드는 유지한다.
- `final2`, `latest`, `진짜최종`을 새 이름에 사용하지 않는다. 공존해야 하는 개정은 `v001`, `v002`로 구분하고 사용 버전을 README에 명시한다. 일상 수정은 Git 이력을 사용한다.
- 기존 파일은 이름을 보기 좋게 만들기 위해 일괄 변경하지 않는다. 모든 경로는 저장소 기준 상대경로로 기록한다.
- `planned`: 필요하지만 미접수. `received`: 등록 파일과 해시 확인. `approved`: 규격·타깃 기기 검증과 승인 근거까지 확보.
- 파일 이동, 이름, 제작자의 `validation` 보고서만으로 `approved`로 올리지 않는다. 담당자·라이선스·치수·성능이 미확인이면 그대로 미확인으로 기록한다.
- `사용 중`, `테스트 사용`, `전시 채택`은 납품 상태와 별개다. 실제 사용 장면과 확인 근거를 README 또는 manifest의 `notes`에 적는다.
- 한 원본에서 여러 GLB가 나오면 manifest 여러 행에서 같은 원본을 참조한다. 파일별 전체 목록과 논리 에셋 목록을 억지로 1:1로 만들지 않는다.
- 새 맵 `map_version`, 상황 30개 좌표, NPC 경로, 지역 경계는 별도 확정 전까지 비워 둔다. 시제품 좌표를 채우지 않는다.

## 5. 새 에셋 접수 순서

1. 작업 전 `git status`와 적용되는 AGENTS/CLAUDE 지침을 읽고 기존 변경을 보존한다.
2. 받은 ZIP은 `archive/packages`, 미분류 파일은 `incoming`에 둔다. 압축 해제 시 외부경로/상위경로로 파일을 쓰지 않도록 검사한다.
3. 파일·출처·원본·변형 관계를 확인하고 library의 적절한 묶음에 넣는다. 기존 파일을 덮어쓰지 않는다.
4. README에 원본, 교환본, 미리보기 링크, 버전, 용도, 확인하지 못한 항목을 기록한다. 공급자 안내는 원문을 보존한다.
5. 논리 모델을 manifest에 등록한다. 실제 존재하는 경로와 SHA-256을 기입하고 기존 키를 중복 생성하지 않는다.
6. 필요한 교환본만 Unity/Web에 반영하고 사용처와 원본 관계를 기록한다.
7. 아래 목록 갱신 및 검사를 실행한다. 모델 변경 시에는 실제 Blender/Unity/Web 로딩·크기·재질·애니메이션도 확인하고 미실행 항목을 보고한다.

## 6. 이동·중복 정리 절차

1. 이동 전 기존 경로, 새 경로, SHA-256을 기록한다. 전체 폴더 이동 시 포함 파일도 기록한다.
2. GUID 참조, 코드 문자열, 장면·프리팹·빌드 설정, 원본의 외부 텍스처, 문서 링크를 조사한다.
3. 대상 경로 충돌은 자동 덮어쓰지 않고 중단한다. 이동 후 해시를 비교한다.
4. 참조를 갱신하고 manifest 및 inventory를 갱신한다. 이동 이력은 `catalog/moves-YYYY-MM-DD.json`에 보관한다. 같은 날 이력이 있으면 덮어쓰지 말고 별도 접미사를 쓴다.
5. 해시가 같은 파일도 자동 삭제하지 않는다. 서로 다른 GUID/플랫폼/배포 목적이 있을 수 있다. 이름이 같지만 해시가 다르면 다른 버전 또는 변형으로 취급한다.
6. 교체/미사용 근거가 있는 파일만 archive로 옮긴다. 사용 여부가 미확정이면 유지한다. 삭제는 별도 명시적 요청이나 검증된 보존 정책이 있을 때 수행한다.

## 7. 반복 실행할 검사

저장소 루트에서 Python 3 표준 라이브러리만으로 실행한다.

```sh
python3 scripts/assets/catalog.py
python3 scripts/assets/catalog.py --check
```

첫 명령은 inventory를 갱신한다. 두 번째 명령은 수정 없이 manifest 키·상태·경로·해시와 inventory 최신 여부를 검사하고 오류가 있으면 실패한다. 스크립트는 파일 이동·삭제·승인 변경을 하지 않는다. 캐시, 숨김 파일은 제외하고 Unity `.meta`는 목록에 포함한다.

이 검사는 Blender 외부 참조, Unity 컴파일/Play Mode, 전시 승인, 모든 GUID 참조의 유효성을 대신하지 않는다. AI는 실행한 검사와 실행하지 못한 검사를 구분해서 보고한다.
