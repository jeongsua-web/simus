# Phase 2-B — Unity WebGL 배포 산출물

## 저장 및 전달 결정

대형 WebGL 바이너리는 Git에 추가하지 않고 **같은 GitHub 저장소의 버전별 Release asset**으로 보관한다. Git에는 [`web/unity-build.lock.json`](../../web/unity-build.lock.json)의 Release 태그, 묶음 SHA-256·크기, 파일별 SHA-256·크기, 맵/경로 계약을 기록한다. `latest` 다운로드나 만료되는 Actions artifact에 의존하지 않는다. 기존 태그/파일을 덮어쓰지 않고 변경마다 새 Release와 lock을 만든다. 같은 태그의 asset이 교체되어도 해시가 달라지면 배포를 거부한다.

실행한 검사와 미실행 범위는 [Phase 2-B 검증 기록](../verification/unity-webgl-phase2b.md)을 확인한다.

전달 경로:

```text
로컬 Unity 빌드 → 검증된 tar.gz → GitHub Release
→ Actions 인증 다운로드 → 묶음/파일/맵 검증
→ web/public → Docker path context → Next.js standalone 이미지
→ GHCR → EC2에서 이미지 pull → 같은 출처의 iframe/WebGL/API
```

이번 묶음의 현재 값:

| 항목 | 값 |
|---|---|
| Release 저장소 | `jeongsua-web/simus` |
| 태그 | `unity-webgl-1ba4e9a12216d3ee` |
| asset | `unity-webgl-1ba4e9a12216d3ee.tar.gz` |
| SHA-256 | `1ba4e9a12216d3ee4bbcbaf80c2ae4106db474a7545726604949385353505c23` |
| 크기 | 78,292,815 bytes, 파일 20개 |
| 로컬 준비본 | `builds/unity-releases/phase2b-20261020/` (Git 제외) |

로컬 준비본은 이 작업 PC에만 있다. **Release asset 업로드가 완료되기 전에는 Actions의 fetch 단계가 실패한다.** 로컬 파일이나 빈 화면으로 대체해 이미지를 성공시키지 않는다. Release/GHCR 게시와 EC2 배포는 이번 준비 작업에서 실행하지 않았다.

## 포함하는 화면과 버전

| 웹 경로 | map_version | 용도 |
|---|---|---|
| `/city-rebuild-v002/` | `test-only-city-rebuild-v002-webgl-v1` | 현재 v002 참여 화면. `city-rebuild-v002-session`, NPC 이동 활성, `city-rebuild-v002-walk-v1` 필수 |
| `/city/` | `dev-synthetic-v1` | 기존 개발 회차와의 호환용 합성 시험 도시 |
| `/unity-preview/` | `null` | `/unity` 페이지의 독립 NPC 추적 미리보기 |

세 빌드 모두 `exhibition_ready:false`다. 새 전시용 맵 승인, 30개 상황 좌표, 지역 경계를 확정하거나 기존 회차 스냅샷을 변경하지 않는다. 시제품 Neighborhood를 재사용하지 않는다. 참여 페이지의 기존 `cityBuildBase` 선택과 `build.json`/실제 Unity `READY`의 map_version 검사도 유지한다.

새 v002 회차는 기존 관리자 화면의 v002 프로필로 준비한다. 기존 회차를 새 맵으로 강제 변경하지 않는다. `pending-map-v1` 등 이 묶음과 다른 맵의 회차는 버전 검사에 실패하며, DB를 준비할 때 호환되는 회차를 선택해야 한다. 전시 맵 확정 후에는 별도의 계약·lock·새 회차 준비가 필요하다.

## 최초 Release 등록

아래는 준비된 파일을 게시하는 명령이다. 이미 GitHub에 존재하는 검토된 빌드 기준 커밋을 `<reviewed_commit_sha>`에 지정한다. 실제 외부 게시는 배포 담당자가 승인 후 실행한다. 테스트용임을 표시하여 prerelease로 등록한다.

```sh
gh release create unity-webgl-1ba4e9a12216d3ee \
  builds/unity-releases/phase2b-20261020/unity-webgl-1ba4e9a12216d3ee.tar.gz \
  --repo jeongsua-web/simus \
  --target <reviewed_commit_sha> \
  --title 'SIMUS WebGL deployment candidate 2026-10-20' \
  --notes 'Phase 2-B deployment candidate. Test maps only; exhibition_ready=false. File hashes are pinned in web/unity-build.lock.json.' \
  --prerelease --latest=false
```

업로드 후 **새 checkout**에서 `node web/scripts/unity-artifact.mjs fetch`를 실행하거나 Actions를 실행한다. 같은 저장소의 비공개 Release도 Actions `GITHUB_TOKEN`의 `contents:read`로 다운로드하며, 별도 PAT나 AWS 자격증명을 이미지에 전달하지 않는다. 로컬 실행은 `gh` 로그인이 필요하다.

## Actions와 Docker

[`docker-publish.yml`](../../.github/workflows/docker-publish.yml)은 Phase 2-C의 기존 트리거를 유지한다. PR은 검증만 하고, main/develop push 및 수동 실행은 검증 후 GHCR에 게시한다. 각 job이 같은 Release/lock을 내려받는다. Actions의 Packages 쓰기를 허용해야 한다. EC2 SSH/자동 배포 단계는 없다. 게시 태그·멀티 아키텍처·운영 Compose는 [Phase 2-C 안내](docker-ghcr-ec2.md)를 따른다.

1. Node 24에서 산출물 검증 테스트를 실행한다.
2. lock의 정확한 Release asset을 인증 다운로드한다. 압축 묶음의 SHA-256·크기를 먼저 검사한다.
3. tar의 전체 경로·파일 집합·파일 종류를 검사하고, 임시 디렉터리에 풀어 파일별 해시·맵/경로 계약을 검증한다. 심볼릭 링크·경로 이탈·압축 WebGL·누락 파일·추가 파일을 거부한다. 기존 빌드 디렉터리가 있으면 덮어쓰지 않는다.
4. **`context: .`**인 저장소 루트의 path context로 Docker를 빌드한다. 기본 Git context로 바꾸면 다운로드한 Git 제외 파일이 사라질 수 있다.
5. [루트 Dockerfile](../../Dockerfile)이 빌드 전과 최종 이미지에서 검증한다. 루트 `.dockerignore`는 `.env*`, node_modules, `.next`, 테스트용 추가 빌드를 제외하면서 세 배포 디렉터리와 lock/검증기를 포함한다.
6. Node 24/Linux amd64에서 Next.js를 standalone으로 빌드하고 `public`·`.next/static`을 최종 이미지에 명시적으로 복사한다. 최종 런타임은 일반 사용자 `node`다. 빌드에 DB 자격증명이 필요하지 않다.
7. verify job의 최종 이미지를 임시 컨테이너로 실행하여 20개 파일의 HTTP 200·SHA-256·크기, JS/HTML/WASM MIME, 캐시 재검증을 확인한 뒤에만 publish job으로 진행한다. 이 정적 파일 검증은 DB를 연결하지 않는다. publish job도 동일한 lock을 fetch하고 각 최종 이미지에서 파일을 재검증한다.

현재 빌드는 Unity 압축 Disabled다. `.wasm` 응답은 `application/wasm`이며 `.gz`/`.br`/`.unityweb` 산출물을 혼합하지 않는다. `Cache-Control: no-cache, must-revalidate`로 고정 파일명의 이전 HTML/로더가 남는 문제를 줄인다. `/unity-preview`와 참여 iframe, API는 같은 HTTPS 출처로 제공한다. 프록시가 WASM MIME·캐시 헤더를 덮어쓰거나 iframe을 차단하지 않아야 한다.

## 로컬 재현과 후속 빌드

```sh
# 현재 작업 파일 검증 (기존 npm run dev 흐름은 그대로 사용 가능)
node web/scripts/unity-artifact.mjs verify
node --test web/tests/unity-artifact.test.mjs

# 새 후보를 별도 디렉터리에 묶는다. 기존 lock을 자동 변경하지 않는다.
node web/scripts/unity-artifact.mjs pack web/public /tmp/simus-next-unity-release

# 새 checkout에서 업로드된 lock 버전을 다운로드/설치
node web/scripts/unity-artifact.mjs fetch

# 또는 정확한 archive를 비어 있는 public 대상에 설치
node web/scripts/unity-artifact.mjs install /path/to/locked.tar.gz /tmp/empty-public

# 설치한 public을 사용하는 Docker 이미지 빌드
docker build --platform linux/amd64 --tag simus:phase2b .

# 실행 중인 서버가 반환하는 전체 파일 검증
node web/scripts/unity-artifact.mjs check-http http://127.0.0.1:3000
```

새 후보의 `unity-build.lock.json`을 검토하여 저장소의 lock을 교체하고, 그 lock의 파일명/태그로 새 Release를 등록한다. pack 이후 파일을 수정하면 다시 pack해야 한다. `unity/Builds`·`web/public`의 기존 Git 제외 규칙은 유지한다. 전시용 맵 계약이 확정되면 검증기의 `contracts`도 함께 검토해 변경한다.

실제 브라우저 렌더링은 아래 스크립트로 확인한다. Playwright 모듈과 Chromium 경로는 검사 환경에 맞게 지정한다. 이는 세 런타임의 실제 READY와 canvas를 검사하며 DB/API를 모킹하지 않는다. 관리자 회차 생성·NPC 동기화·상황 응답의 전체 검사는 별도의 `web/tests/v002-session-browser.mjs` 범위다.

```sh
TEST_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
TEST_CHROMIUM_EXECUTABLE=/path/to/chromium \
TEST_API_URL=http://127.0.0.1:3000 \
node web/tests/unity-artifact-browser.mjs
```

## EC2 인수 및 복구

EC2는 GHCR의 검증된 이미지 digest를 가져와 사용한다. Unity 또는 Next.js를 t3.small에서 빌드하지 않는다. 운영 환경변수·DB 연결·HTTPS는 [운영 Compose 구성](docker-ghcr-ec2.md)에서 주입한다. `/app/public` 또는 `/app`에 호스트 디렉터리를 덮어씌우면 이미지에 포함된 WebGL이 가려지므로 해당 bind mount를 사용하지 않는다.

배포 후 `check-http https://<실제호스트>`로 프록시까지 포함한 파일/헤더/해시를 확인하고 `/unity`에서 실제 미리보기를 확인한다. 호환되는 새 v002 회차에 참여해 Unity 도시·내 NPC·상황 표시를 확인해야 운영 인수가 완료된다. 정적 HTTP 성공만으로 회차 데이터 및 모바일 성능 검증을 대신하지 않는다.

복구 시 이전 이미지 digest로 되돌린다. 각 이미지가 코드와 WebGL을 함께 보유하므로 EC2에서 별도 파일 교체가 필요 없다. 이전 Release asset과 lock을 보존하고, DB 볼륨이나 기존 회차 스냅샷은 이 과정에서 변경하지 않는다.

근거: 저장소에 설치된 Next.js 16.3.8의 `output`/self-hosting 가이드, [Docker의 Next.js 컨테이너 가이드](https://docs.docker.com/guides/nextjs/), [Unity 6.3 Web 배포 가이드](https://docs.unity3d.com/6000.3/Documentation/Manual/webgl-deploying.html), [GitHub 토큰 권한](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token), [gh release download](https://cli.github.com/manual/gh_release_download).
