# 전시용 에셋 관리

에셋 작업 전 [정리 규칙](ASSET_RULES.md)을 읽는다. [탐색 목록](catalog/README.md)에서 원본·교환본·Unity 사용 위치를 찾고, [전체 파일 목록](catalog/inventory.json)은 `python3 scripts/assets/catalog.py`로 갱신한다. 기존 `assets/assets/`는 `library/`와 `archive/`로 정리했다.

전시용 새 맵과 모델의 납품 상태는 [`manifest.csv`](manifest.csv)에서 관리한다. 이 목록의 `planned`는 필요한 항목을 뜻하며, 제작 완료나 규격 승인을 뜻하지 않는다. 새 맵의 `map_version`, 30개 상황 위치, 경로와 지역 경계는 [5A 인계](../docs/content/new-map-handoff-5a.md)에서 확정하기 전까지 비워 둔다.

## 현재 보유한 시제품 자산

| 파일 | 크기 | SHA-256 | 용도 |
|---|---:|---|---|
| `unity/Assets/Art/Neighborhood.fbx` | 3,496,540 B | `ccd3d127fabe4d3a225e057cadda9775e2674336b8e09f452d2b68d8856513e8` | 기존 Unity 시제품 맵 |

이 파일과 `unity/Assets/Materials`, `unity/Assets/Scenes/Neighborhood*.unity`는 시제품용이다. 새 전시용 맵의 위치, 동선, 최종 에셋으로 승인하지 않는다. 시제품 검증 이미지는 `docs/unity-neighborhood`에 남아 있다. 중복 FBX·검증 이미지와 기존 웹 GLB가 있던 `simus-stage4-8/`는 2026-10-08 삭제했다. 삭제한 자료는 Git 커밋 `e0be15016992a46025b5a38b870734a4683006c1`에서 확인할 수 있다.

## 접수한 새 건물 후보

`unity/Assets/department_store_v2/`의 백화점은 원본 `.blend`, 교환 `.glb`, Unity용 `.fbx`, 미리보기 PNG가 있다. 원본과 교환본의 해시는 목록에 등록했다. FBX의 SHA-256은 `18efee1cebc89bd0e48ded53c3b0022902a38369916186c5e01fd94991c80779`, 미리보기 PNG는 `34076c056119522fa99c39e975e5edd428ea590060e698fdc5c80b77eb0ff772`다. GLB 헤더는 glTF 2.0이고 메시 14개, 재질 14개, 포함 이미지·텍스처 0개다. 모델 크기 24.4 × 18.7 × 13.8m와 원점은 제작 안내의 주장으로, Unity 실측은 아직 하지 않았다. 새 맵 내 위치와 채택 여부는 미정이다.

## 납품 등록

1. 새 자산을 받을 때 `manifest.csv`의 해당 행에 저장소 기준 상대 경로를 기록한다. `source_file`은 `.blend`, `exchange_file`은 `.glb`다. 한 Blender 원본이 여러 교환본을 만들면 여러 행에 같은 `source_file`을 적는다.
2. 파일을 실제로 확인한 뒤 각 파일의 SHA-256과 제작자, 원점·크기·삼각형·재질·텍스처 정보 및 라이선스/출처를 기록한다. 상세 값은 `notes` 또는 별도 인계 문서에 적는다. `received`는 파일과 해시를 등록한 상태다.
3. Blender→GLB 축 변환, Unity 실측 크기, 지면 접촉, 모바일 로딩·프레임·발열, 상태 자산의 원점 일치를 확인한 뒤 `approved`로 바꾼다. 성능 예산과 파일명 규칙은 첫 샘플 측정 뒤 확정한다.
4. 새 맵의 `map_version`과 배치표를 확정하기 전에는 이 목록의 경로를 전시 시드 좌표로 사용하지 않는다. 맵 자산 승인과 30개 상황 배치 승인은 별도 결정이다.

`planned` → `received` → `approved` 상태를 사용한다. `received`는 파일 존재와 해시만 확인한 상태다. 파일이 반려되면 `planned`로 되돌리고 이유를 `notes`에 남긴다. `asset_key`는 안정적인 식별자이며 변경할 때는 사용처도 함께 검토한다.
