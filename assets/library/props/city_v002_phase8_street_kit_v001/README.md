# City v002 Phase 8 street kit v001

CityRebuild_v002 Phase 8-B용 신규 화단·벤치·가로등 묶음. `received` 상태이며 전시 승인이나 성능 개선을 의미하지 않는다. 기존 건물·도로·Blender 원본을 수정하지 않았다.

- [Blender 원본](source/phase8_street_kit.blend)
- [FBX 교환본](exports/phase8_street_kit.fbx)
- [Blender 미리보기](previews/phase8_street_kit.png) — Unity Game View가 아니다.
- [실제 Blender 재가져오기 검증](reports/blender-validation.json)
- Unity 작업 사본: `unity/Assets/SIMUS/Art/props/city_v002_phase8/phase8_street_kit.fbx`
- 제작 스크립트: `scripts/assets/build_city_v002_phase8_street_kit.py`

| FBX mesh | 가로×깊이×높이 m | 삼각형 |
|---|---:|---:|
| Phase8_Planter | 1.800×0.700×0.810 | 392 |
| Phase8_Bench | 2.000×0.700×0.850 | 748 |
| Phase8_Streetlamp | 0.400×0.400×4.500 | 376 |

단위 1m, 각 모델은 지면 중앙 원점이다. 원본은 편집 편의를 위해 3개 모듈을 옆으로 정렬하고, FBX에서는 각 모듈이 같은 원점에 겹쳐 있다. **전체 root를 한꺼번에 표시하지 말고 이름으로 필요한 child mesh를 선택한다.** FBX는 `-Z forward / Y up`, unit scale 적용으로 내보냈다. Unity에서는 가져온 child의 축 변환을 유지한 yaw wrapper를 사용하고 실제 bounds로 바닥을 확인한다.

저채도 크림·목재·짙은 청회색의 무텍스처 matte 재질 9종을 공유한다. Blender preview 조명은 렌더 검수 전용이며 원본·FBX에 포함하지 않는다. 가로등 유리는 낮 시간용 불투명 크림 재질이며 실제 Light, emissive 효과, Collider, animation, LOD는 포함하지 않는다. Unity 공용 재질 재매핑은 원본을 바꾸지 않고 수행한다.

기존 승인 보행 그래프와 건물 envelope 밖에 배치한다. 모델에 Collider가 없더라도 NPC 몸과 겹치면 안 된다. 배치 시 유한폭 경로와 실제 렌더러 bounds를 대조해야 하며, 새 장식 배치의 Unity Physics/Play Mode 검증은 Unity·QA 보고서의 범위다.

Blender 5.2.2 LTS에서 실제 생성, source reopen, FBX reimport, grounded bounds 및 유한 좌표 검사를 수행했다. source와 export는 저장한 SHA-256으로 manifest에 등록한다. 제작자는 본 작업의 Codex Blender 담당이며 외부 이미지·텍스처·모델을 사용하지 않았다.
