# 5A 전시 콘텐츠 데이터와 자산 인계

`situations-and-choices.md`를 승인 원문으로 사용한다. `node db/generate_exhibition_seed.mjs`가 30상황·91선택지를 `db/seed_exhibition.sql`로 만든다. `--check`는 원문과 생성물이 같은지 검사한다. 강조 표시 `**`만 제거하고 문구와 수치를 그대로 등록한다.

## 실행 데이터

- 상황 코드 `EXHIBITION_01`~`EXHIBITION_30`, `display_order` 1~30. 제목과 본문은 원문 제목으로 채운다. 각 선택의 순서는 원문 순서다.
- `질서`→`alignment_dx`, `선`→`alignment_dy`, `행복`→`happiness_base`, `치안`→`safety_base`, `청결`→`cleanliness_base`, `오염`→`pollution_base`. `변화 없음`은 모든 값이 0이다. 개인 점수가 ±1을 넘는 선택만 `MAJOR`다.
- 새 맵을 제작할 예정이므로 `EXHIBITION_CITY` 한 지역에 오염 영향을 임시 등록한다. 상황별 위치·NPC 동선이 확정되었다는 뜻이 아니다. 새 맵 확정 후 새 회차의 지역/위치를 정하고 지도 버전을 연결한다.
- 개발용 DRAFT 시드는 `seed_demo.sql` 뒤에 적용한다. 500명·1인 최대 30응답을 예상 수치로 넣었다. 기존 시드의 영향 배율과 성향 경계는 임시로 복사하므로, 5B 시뮬레이션과 콘텐츠 검수 후 전시 회차 설정을 확정해야 한다. 운영 DB에는 시드를 적용하지 않는다.
- `006_content_score_range.sql`은 선택과 원장 점수 범위를 -4~+3으로 확장한다. 기존 행과 회차의 `rules_snapshot`은 바꾸지 않는다. 기존 회차에 저장된 점수와 결과도 재계산하지 않는다.

## Blender/Unity 자산 계약 초안

3A의 Unity 월드 좌표는 m 단위, Y 위쪽, 위치 배열 `[x,y,z]`다. 납품 모델은 바닥 접점에 원점을 두고, 서 있는 캐릭터의 전방을 로컬 +Z로 맞춘다. 기본 캐릭터는 키 1.7m를 기준으로 제작하고 Unity에서 최종 크기를 확인한다. 교환 파일은 `.glb`(glTF 2.0), 원본은 `.blend`로 보관한다. `character_<alignment_code>.glb` 9개 코드와 `city_<stat>_<low|base|high>.glb` 이름을 사용한다. `alignment_code`는 API의 `LAWFUL_GOOD` 등 9종과 일치한다. 도시 자산은 행복·치안·청결·오염별 낮음/기본/높음 상태를 분리해, 다른 상태를 조합해도 원점과 기준 크기가 어긋나지 않도록 같은 씬 기준으로 내보낸다.

위 규격은 첫 샘플 모델을 맞추기 위한 초안이다. 상황 30개의 실제 위치, 도시 자산 분할 단위, 최종 폴리곤/텍스처 예산, 손민경 납품일은 새 지도·기기 실측 후 확정한다. 현재 시드는 위치를 가정해 좌표를 만들지 않는다. [새 맵·자산 인계 항목](new-map-handoff-5a.md)을 참조한다.
