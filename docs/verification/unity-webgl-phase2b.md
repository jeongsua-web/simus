# Phase 2-B — Unity WebGL 배포 준비 검증 (2026-10-20)

판정: 파일 전달·검증·이미지 포함 경로 구현 및 로컬 standalone/실제 WebGL 검증 완료. GitHub Release 업로드, Actions Docker 빌드, GHCR 게시, EC2/HTTPS 운영 인수는 미실행이다.

## 고정 산출물

- Release 태그: `unity-webgl-1ba4e9a12216d3ee`.
- archive SHA-256: `1ba4e9a12216d3ee4bbcbaf80c2ae4106db474a7545726604949385353505c23`.
- 78,292,815 bytes, 20개 파일. 로컬 `builds/unity-releases/phase2b-20261020/`에 준비했다. 원본 바이너리는 계속 Git 제외다.
- `/city-rebuild-v002`, `/city`, `/unity-preview`를 포함하며 모두 전시 승인 전 시험 빌드다. 버전·파일별 해시는 `web/unity-build.lock.json`을 따른다.

## 실행 결과

| 검사 | 결과 |
|---|---|
| `node --test web/tests/unity-artifact.test.mjs` | 7/7 통과. pack/install, 덮어쓰기 거부, 누락/변조/추가 파일, symlink, 잘못된 map/path/이동/전시 상태, 압축 산출물, HTML 참조, archive hash, HTTP MIME/내용 실패 검사 |
| 실제 묶음 → 빈 `/tmp/simus-phase2b-clean-public` 설치 | 통과, 설치 후 파일별 해시·계약 재검증 |
| `node web/scripts/unity-artifact.mjs verify` | 실제 public의 20개 파일 통과 |
| `npm run build` (`web`) | Next.js 16.3.8 프로덕션/TypeScript/standalone 빌드 통과 |
| `npm run lint` (`web`) | 오류 0, 기존 shared-result React effect 경고 1. v002 생성 JS를 lint에서 제외 |
| standalone 서버의 `check-http http://127.0.0.1:3192` | 20개 파일 HTTP 200·원문 SHA-256/크기·WASM/JS/HTML MIME·캐시 재검증 통과 |
| `web/tests/unity-artifact-browser.mjs` | 실제 Chromium + SwiftShader에서 세 런타임 모두 READY/canvas 통과, v002/기존 city map_version 일치, pageerror 0 |
| 스크린샷 육안 확인 | 실제 v002 전체 도시 및 `/unity` NPC 추적 화면 확인. 로컬 `/tmp/simus-phase2b-browser/`에 저장 |
| Actions YAML/내장 Bash 구문 검사 | 통과. verify/publish 양쪽 fetch 및 path context 확인 |
| `scripts/assets/catalog.py`, `--check` | 5,230파일, 오류 0 |
| `git diff --check` | 통과 |

로컬 Node는 v25.8.1, Docker/Actions 정의는 Node 24다. 이 환경에는 Docker 실행기가 없어 컨테이너와 Linux 아키텍처 빌드는 실행하지 못했다. 로컬 standalone 서버에는 검증한 public과 `.next/static`을 복사해 확인했고, 사용한 임시 서버는 종료했다. DB를 연결하지 않아 ticker의 DB 설정 오류는 예상되며 정적 WebGL 렌더링 검증에는 영향을 주지 않았다.

실제 Unity READY는 세 빌드 모두 확인했다. 이번 검사는 새 참여 회차 생성, 서버 NPC 이동/이벤트 동기화, 실제 모바일 기기 성능, 전시용 맵 승인 검사가 아니다. 기존 [관리자–NPC–WebGL 검증](admin-npc-webgl-2026-10-20.md) 범위를 이번 작업의 실행 결과로 합산하지 않는다. 운영 DB·기존 회차·좌표·자산 승인 상태는 변경하지 않았다.

Release asset을 먼저 등록해야 Actions에서 파일을 가져올 수 있다. 최초 업로드 명령 및 운영 인수 순서는 [배포 산출물 안내](../operations/unity-webgl-artifacts.md)에 있다.
