# Phase 2-C — Docker·GHCR 구성 검증

검증일: 2026-10-20. 대상은 저장소 루트 `Dockerfile`, `.dockerignore`, `compose.prod.yaml`, `.env.example`, `.github/workflows/docker-publish.yml`, Next.js standalone 설정과 EC2 운영 안내다. Phase 2-B의 고정 Unity Release/lock 전달 경로도 연결했다.

## 실행한 검사

| 검사 | 결과 |
| --- | --- |
| Workflow/Compose YAML 파싱 | 통과 |
| Workflow의 모든 `run` 단계 `bash -n` | 통과 |
| 모든 외부 Action의 40자리 커밋 SHA 고정 | 통과; 공식 GitHub API의 버전 ref와 대조 |
| 비밀값을 제외한 임시 사본에서 `npm run lint -- src next.config.ts` | 오류 0; 기존 `shared-result/page.tsx`의 React effect 경고 1개 |
| 같은 사본에서 `npm run build` | Next.js 16.3.8 standalone 생성·TypeScript 검사 통과 |
| `node --test web/tests/unity-artifact.test.mjs` | 7개 통과; 합성 파일 및 로컬 HTTP 사용 |
| `node web/scripts/unity-artifact.mjs verify` | 고정한 실제 WebGL 20개 파일의 해시·크기·맵 계약 통과 |
| 임시 standalone 서버 `/`, `/admin`, `/participate` | HTTP 200 |
| 같은 서버의 시민 PNG 및 `.next/static` CSS | HTTP 200 |
| DB 설정 없는 `/api/health` | 예상한 HTTP 503, `status=unhealthy` |
| 같은 서버의 `check-http` | WebGL 20개 파일 HTTP 200·SHA-256·크기·MIME·캐시 헤더 통과 |
| `.env.production` Git ignore | 통과 |
| `git diff --check` | 통과 |
| 에셋 카탈로그 생성 및 `--check` | 오류 0 |

빌드 사본은 추적된 앱 소스·설정·public 파일과 lock으로 검증한 WebGL만 사용하며 `.env.local` 등 실제 환경 파일은 복사하지 않았다. standalone 실행 디렉터리에는 `public`, `.next/static`, lock과 검증기를 최종 Dockerfile과 같은 위치에 배치했다. 로컬 빌드/기동은 설치된 Node 25.8.1로 실행했으며, 워크플로와 Dockerfile은 Node 24를 지정한다. 빌드는 npm/Google Fonts에 대한 네트워크 접근이 필요하다.

처음 실행한 기존 `npm run lint` 전체 검사는 로컬 Git 제외 Unity 생성 JavaScript까지 검사하여 실패했다. Docker 빌드에서는 앱 소스와 Next 설정을 lint하고 WebGL은 전용 검증기로 검사한다. 원본 Unity JavaScript를 lint 오류 수정 목적으로 변경하지 않았다.

## 아직 확인하지 않은 항목

- 이 컴퓨터에는 Docker CLI/Engine이 없어 실제 `docker build`, Compose `config/up`, 이미지의 Linux·일반 사용자 기동은 로컬에서 실행하지 않았다. YAML/Bash 정적 검사는 Docker 자체의 검증을 대신하지 않는다.
- GitHub Actions 실행과 AMD64/ARM64 이미지 빌드·게시, private GHCR pull은 아직 실행하지 않았다. 워크플로가 이 검사를 수행하도록 준비했다.
- pinned WebGL Release는 로컬 준비 상태이며 최초 외부 업로드는 별도 단계다. Release가 없거나 해시가 다르면 Actions의 fetch가 실패하도록 했다.
- EC2 자원 생성·접속·배포·HTTPS 프록시·실제 관리자 인증 및 운영 DB 연결은 실행하지 않았다. DB 마이그레이션/seed/운영 통합 테스트도 실행하지 않았다.
- 이번 HTTP 검사는 WebGL 파일 전달을 검증한다. 실제 WebGL 렌더링·참가자 NPC 동기화·모바일 인수·새 전시 맵 승인을 뜻하지 않는다.

실제 첫 실행과 EC2 pull·업데이트·롤백 명령은 [운영 안내](../operations/docker-ghcr-ec2.md)를 따른다.
