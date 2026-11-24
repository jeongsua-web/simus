# ADR 0001 — 전시용 맵을 새로 제작한다

| 항목 | 내용 |
| --- | --- |
| 상태 | 채택 |
| 기록일 | 2026-11-18 |
| 원결정 | 2026-10-01 |

## 배경

기존 Neighborhood는 Unity 연동을 검증한 시제품이다. 전시용 맵은 30개 상황의 상호작용 지점과 접근 경로, NPC 이동, 지역별 집계를 함께 수용해야 한다.

## 결정

전시용 맵을 새로 제작한다. `Neighborhood.fbx`, `neighborhood.glb`, `walkway-v1`은 시제품 자료로 보존하고, 전시 데이터의 좌표와 동선은 새 맵에서 산출한다. 새 맵의 식별자 `map_version`과 경로 버전 `path_version`을 기준으로 회차 데이터와 웹·Unity 표시를 맞춘다.

## 영향

- 30개 상황의 위치와 접근 경로, 지역 경계, NPC 동선, Blender 원본과 교환 파일을 새 맵에서 대조한다. 승인된 경로는 `DRAFT` 회차에 설정한다.
- v003 로컬 플레이는 `EXHIBITION_30`을 대상으로 한다. 나머지 29개는 배치표에 저장 씬 위치와 후보 접근 경로를 기록한 상태다. 최종 전시 맵과 30개 상황의 운영 배치는 전시 인수에서 확인한다.

## 근거

- [프로젝트 결정](../../AGENTS.md) · [10월 1일 새 맵 인계](../content/new-map-handoff-5a.md)
- [NPC 공유 계약](../contracts/participant-npc-api.md) · [v003 로컬 플레이 인계](../content/v003-local-play-handoff.md)
