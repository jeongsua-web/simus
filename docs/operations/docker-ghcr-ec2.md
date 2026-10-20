# Phase 2-C — Docker·GHCR·EC2 실행

저장소 루트의 `Dockerfile`로 Next.js 앱을 빌드하고 `ghcr.io/jeongsua-web/simus`에 게시한 뒤, EC2에서 `compose.prod.yaml`로 실행한다. EC2에서는 Node/npm과 소스 빌드가 필요 없다. 기존 `compose.yaml`은 개발 전용이며 운영 명령에는 항상 `-f compose.prod.yaml`을 지정한다. 두 Compose 파일을 병합하지 않는다.

현재 운영 구성은 **같은 EC2의 웹 컨테이너 + PostgreSQL 16 컨테이너**다. 최초 DB 생성·초기화 및 실행 승인은 [EC2 PostgreSQL 최초 배포 승인안](ec2-postgres-first-deploy.md)을 따른다. DB 마이그레이션 실행 테스트는 이번 배포에서 보류한다. 새 빈 볼륨의 첫 DB 기동은 미리 생성한 managed init SQL(001~011 → 013 → 016 → 015)과 제한된 앱 계정을 생성한다. 운영 seed·012·014·회차 시작은 실행하지 않는다. 아래의 이미지 게시·HTTPS·업데이트 설명을 참고하되, 최초 파일 전달/환경변수/DB 실행은 연결한 승인안의 전체 절차를 우선한다.

## 파일과 이미지 내용

| 파일 | 역할 |
| --- | --- |
| `Dockerfile` | Node 24 Debian slim, `npm ci`, lint/build, standalone 결과만 복사, 일반 `node` 사용자로 실행 |
| `.dockerignore` | 앱 빌드 입력만 허용; 환경 파일·키·Git·Unity/Blender 원본 제외; lock으로 검증하는 Release WebGL 산출물 포함 |
| `web/next.config.ts` | `output: "standalone"`; 최종 이미지에 `public`과 `.next/static`도 명시적으로 복사 |
| `compose.prod.yaml` | GHCR 웹 이미지와 PostgreSQL 16, 내부 DB 네트워크·named volume·초기화·메모리/로그 제한 |
| `.env.example` | EC2의 `.env.production` 작성 양식; 실제 값은 Git 제외 |
| `.github/workflows/docker-publish.yml` | PR 이미지 검증, main/develop push 및 수동 실행에서 GHCR 게시 |

이미지는 웹과 API를 제공하며 기존 추적 파일인 시민 이미지도 포함한다. 빌드에 DB/JWT/VAPID 비밀값을 전달하지 않는다. `NEXT_PUBLIC_*`나 Docker build argument로 비밀값을 넣지 않는다.

## 1. GitHub 설정과 첫 이미지 만들기

1. [Phase 2-B](unity-webgl-artifacts.md)의 pinned Unity Release asset을 먼저 등록한 뒤 변경을 GitHub 저장소에 반영한다. asset이 없거나 해시/버전이 다르면 verify와 publish는 실패한다. `main` 또는 `develop` push로 자동 실행되며, Actions의 **Docker build and GHCR publish → Run workflow**로 브랜치를 선택할 수도 있다. 수동 실행 목록은 워크플로 파일이 기본 브랜치에 반영된 뒤 사용할 수 있다.
2. 저장소의 **Settings → Actions → General**에서 GitHub 및 Docker Actions 실행과 조직의 패키지 생성 정책이 허용되는지 확인한다. 게시 job이 `contents: read`, `packages: write`를 요청한다. 인증은 자동 제공되는 `GITHUB_TOKEN`을 사용하므로 GHCR 게시용 PAT나 AWS 키를 GitHub Secrets에 추가할 필요가 없다.
3. `verify`는 production Compose 검사, WebGL 검증기 테스트와 고정 Release 다운로드, AMD64 Docker 이미지 빌드(앱 소스 lint 포함), 일반 사용자 실행, 페이지/시민 이미지 및 WebGL 20개 파일의 HTTP 해시·MIME·캐시 응답을 검사한다. 기동 검사에서는 외부 네트워크를 차단하고 DB 환경을 주지 않으며, `/api/health`의 **503**을 예상한다. 이 검사는 DB 스키마나 업무 기능의 통합 테스트가 아니다.
4. 검증이 성공하면 `publish`가 `linux/amd64,linux/arm64` 이미지를 게시한다. EC2 x86_64와 Graviton 모두 같은 이미지 주소를 사용한다. PR은 검증만 하며 로그인·게시하지 않는다.
5. Actions 실행 요약의 **EC2 image**에서 SHA 태그 또는 digest 주소를 복사한다. 첫 게시 전에는 패키지가 존재하지 않을 수 있다. 저장소 또는 사용자 프로필의 **Packages → simus**에서 생성 결과를 확인한다.

| 이벤트/태그 | 의미 |
| --- | --- |
| `sha-<전체 40자리 commit SHA>` | 모든 게시 실행에서 생성; 해당 소스 빌드 식별 |
| `latest` | main에서만 갱신 |
| `develop` | develop에서만 갱신 |
| `@sha256:<digest>` | 특정 이미지 내용 고정; 운영 배포와 롤백에 권장 |

수동으로 다른 브랜치를 실행하면 SHA 태그만 게시한다. 같은 커밋도 기반 이미지 갱신 후 재빌드하면 digest가 달라질 수 있다. `latest`/`develop`만 기록해 두면 이전 이미지로 돌아갈 수 없으므로 실제 사용한 digest를 보관한다.

GHCR 패키지는 처음에는 private일 수 있다. 기존 같은 이름의 패키지 때문에 `permission_denied: write_package`가 발생하면 패키지 **Settings → Manage Actions access**에서 이 저장소의 Write 권한/연결을 확인한다. 워크플로는 패키지 공개 범위를 변경하지 않는다.

## 2. EC2 준비

Ubuntu 24.04 LTS 기준이다. [Docker 공식 Ubuntu 설치 안내](https://docs.docker.com/engine/install/ubuntu/)에 따라 Docker Engine, Buildx, Compose 플러그인을 설치한다. 배포 명령은 아래처럼 `sudo docker`를 기준으로 하며 로그인도 같은 사용자 컨텍스트에서 수행한다.

```sh
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
mkdir -p ~/simus
chmod 700 ~/simus
```

`up --wait`를 지원하는 Compose v2 이상이 필요하다(현재 대상 2.40.3). EC2 보안 그룹은 SSH를 관리자 IP로 제한하고, 공개 서비스는 HTTPS 443으로 제공한다. 기본 웹 바인딩은 `127.0.0.1:3000`이므로 같은 EC2의 HTTPS reverse proxy에서 연결한다. 호스트 포트 3000과 DB 5432를 인터넷 전체에 열지 않는다. DB 5432는 host에 게시하지 않고 내부 `database` 네트워크에서만 사용한다.

ALB를 사용한다면 `SIMUS_BIND_ADDRESS=0.0.0.0`으로 변경하고 EC2의 3000 인바운드는 **ALB 보안 그룹에서만** 허용한다. ALB HTTPS listener와 대상 그룹 healthcheck `/api/health`를 별도로 준비한다.

## 3. 배포 파일과 런타임 설정

최초 배포에는 아래 두 파일 외에도 DB 원본/체크섬/016, runner, 준비 도구와 초기화 shell이 필요하다. **[최초 배포 승인안의 파일 전달 및 SQL 생성 절차](ec2-postgres-first-deploy.md)를 완료해야 하며 승인 전에는 실행하지 않는다.** 아래 두 파일 전송 예시만으로는 DB를 기동할 수 없다. `EC2_PUBLIC_DNS`와 키 경로는 실제 값으로 바꾼다.

```sh
scp -i /path/to/ec2-key.pem compose.prod.yaml .env.example ubuntu@EC2_PUBLIC_DNS:~/simus/
```

이후 EC2에서 실행한다. 업데이트 시에도 배포할 이미지 버전과 일치하는 Compose 파일을 복사한다.

```sh
cd ~/simus
# 최초 설정 때만 복사한다. 기존 운영 파일은 덮어쓰지 않는다.
cp -n .env.example .env.production
chmod 600 .env.production
nano .env.production
```

다음 값을 실제 환경으로 바꾼다. 샘플의 `REPLACE_...`는 사용 가능한 자격 정보가 아니다.

- `SIMUS_IMAGE`: Actions 요약의 `ghcr.io/jeongsua-web/simus@sha256:...` 또는 전체 SHA 태그.
- `POSTGRES_PASSWORD`, `SIMUS_DB_PASSWORD`: 각각 서로 다른 `openssl rand -hex 32` 값. 앱 URL은 `simus_app@db:5432/simus`로 Compose에서 조립하며 web에 관리자 비밀번호를 주입하지 않는다. 환경변수 변경만으로 기존 DB 비밀번호가 바뀌지 않는다.
- `ADMIN_TOKEN_ISSUER`, `ADMIN_TOKEN_AUDIENCE`: 실제 RS256 JWT 발급자의 iss/aud. `ADMIN_JWKS_URL`(HTTPS 공개키 endpoint) 또는 `ADMIN_JWKS_JSON`(공개키 JSON) 중 **정확히 하나**만 채운다. DB의 활성 `admin_users.auth_subject`도 발급자의 sub와 일치해야 한다. [관리자 설정](demo-deployment.md#실제-서버-관리자-설정)을 참고한다.
- `SESSION_JOB_TOKEN`: EC2에서 `openssl rand -hex 32`로 생성한 별도 값. 최소 32자이며 reconcile 작업과 일치시킨다. 주기 작업의 설치·실행은 [종료 정책](../contracts/session-lifecycle.md)의 운영 절차를 따른다.
- VAPID 세 값은 웹 푸시를 사용하는 경우 함께 설정한다. 개인키는 서버에만 보관한다.

Compose `.env` 문법이 적용되므로 `$`가 들어간 값과 JSON은 작은따옴표로 감싸서 리터럴을 보존한다. `.env.production`을 shell `source`로 실행하지 않는다. `--env-file`은 Compose 변수 치환에 사용하고, `environment`에 명시된 앱 설정만 컨테이너로 전달한다. 셸에 export한 같은 이름의 변수는 파일보다 우선하므로 다른 환경의 값이 남아 있지 않은지 확인한다. `config` 전체 출력은 비밀값이 포함될 수 있으므로 검사에는 `config --quiet`를 사용한다.

## 4. GHCR 로그인·pull·실행

공개 패키지는 로그인 없이 pull할 수 있다. private 패키지는 패키지 읽기 권한이 있는 GitHub 계정과 **PAT classic의 `read:packages`** 권한을 사용한다. 조직 SSO를 사용하면 해당 토큰의 조직 승인도 필요하다. EC2는 워크플로의 일회성 `GITHUB_TOKEN`을 사용하지 않는다.

EC2의 Bash에서 입력한다. 토큰 값을 명령 이력에 직접 쓰지 않는다.

```bash
read -r -p 'GitHub username: ' GHCR_USER
read -r -s -p 'GHCR read token: ' GHCR_TOKEN
echo
printf '%s' "$GHCR_TOKEN" | sudo docker login ghcr.io --username "$GHCR_USER" --password-stdin
unset GHCR_TOKEN GHCR_USER
```

로그인 정보는 Docker 사용자 설정에 저장된다. EC2 접근 권한을 제한하며 조직 정책에 맞는 credential helper를 사용할 수 있다. `sudo docker login`과 일반 `docker pull`은 서로 다른 인증 파일을 사용한다.

```sh
cd ~/simus
sudo docker compose --env-file .env.production -f compose.prod.yaml config --quiet
sudo docker compose --env-file .env.production -f compose.prod.yaml pull web
sudo docker compose --env-file .env.production -f compose.prod.yaml up -d --no-build --wait --wait-timeout 120 web
sudo docker compose --env-file .env.production -f compose.prod.yaml ps
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
```

이 명령 묶음은 **최초 승인안의 SQL 생성과 DB 초기화 완료 후** 웹 실행/업데이트에 사용한다. web의 `depends_on` 때문에 DB가 없으면 DB도 시작될 수 있으므로 최초 승인 전에는 실행하지 않는다. 기본 포트를 바꿨다면 curl 주소도 수정한다. health의 `status=healthy`와 `database=simus`를 확인한다. healthcheck는 DB 접속 여부를 검사하며 전체 스키마/마이그레이션 완료를 보증하지 않는다. DB 준비, 관리자 인증, DRAFT 및 승인된 WebGL 배포까지 별도로 확인한다. 이미지 pull/시작만으로 회차를 생성하거나 시작하지 않는다.

같은 EC2의 HTTPS 프록시는 `http://127.0.0.1:3000`으로 전달하고 원래 `Host`, `X-Forwarded-Proto`, `X-Forwarded-For`를 보존한다. 프로덕션 참여 쿠키는 Secure이므로 실제 참여 시험은 **HTTPS 주소**에서 진행한다. HTTP health 확인만으로 참여 쿠키·웹 푸시가 검증된 것은 아니다.

## 5. WebGL 이미지 포함

Phase 2-B로 Unity 파일 전달 경로를 통합했다. Git에서 제외된 `web/public/city`, `city-rebuild-v002`, `unity-preview`를 Actions가 **같은 저장소의 고정 GitHub Release asset**에서 가져온다. `web/unity-build.lock.json`의 archive/개별 파일 SHA-256·크기·맵/경로 버전을 검사하고, Docker 빌드 전과 최종 이미지에서도 검사한다. 파일이 없거나 다르면 게시를 중단한다. verify 컨테이너는 실제 Next.js HTTP 응답의 해시·MIME·캐시도 확인한다.

EC2에 별도로 WebGL을 복사하거나 마운트할 필요가 없다. 코드·Unity가 함께 포함된 이미지 digest를 배포/롤백한다. 기존에 `compose.webgl.yaml`을 사용했다면 오래된 bind mount가 이미지의 파일을 가리지 않도록 제거한 배포 구성을 사용한다. `/app/public` 전체를 마운트하지 않는다.

현재 포함된 v002는 `test-only-city-rebuild-v002-webgl-v1`이며 `exhibition_ready:false`다. 새 전시 맵의 map_version·최종 30상황 위치 확정과 별개이며, 과거 Neighborhood를 재사용하지 않는다. 회차 map_version이 배포 빌드와 맞아야 한다. `/unity` 미리보기와 호환되는 새 v002 회차 참여를 실제 HTTPS 출처에서 확인한다. 최초 Release 등록·재빌드·공개 URL 파일 검증은 [Unity 산출물 안내](unity-webgl-artifacts.md)를 따른다.

이미지 내 파일의 HTTP 검증은 다음 명령으로 수행한다. DB 접속은 하지 않는다.

```sh
sudo docker compose --env-file .env.production -f compose.prod.yaml exec -T web node scripts/unity-artifact.mjs check-http http://127.0.0.1:3000
```

## 6. 업데이트·롤백·문제 확인

배포 전에 현재 사용 중인 **digest**와 Compose 설정 버전을 기록한다. `.env.production`의 `SIMUS_IMAGE`를 새 digest로 변경하고 위의 `pull web` → `up -d --no-build --wait ... web`을 반복한다. 런타임 환경만 바꿀 때는 `up -d --force-recreate --no-build --wait web`으로 재생성한다. 단일 웹 인스턴스이므로 교체 시 짧은 중단이 있을 수 있다.

실패하면 이전 digest로 되돌려 같은 pull/up 명령을 실행한다. 앱 이미지 롤백은 DB 스키마를 되돌리지 않는다. DB 변경이 있었다면 이전 이미지와의 호환성을 먼저 확인한다. `up --wait` 실패 시 기존 컨테이너로 자동 롤백되지는 않는다.

```sh
sudo docker compose --env-file .env.production -f compose.prod.yaml logs --tail 100 web
sudo docker compose --env-file .env.production -f compose.prod.yaml ps
sudo docker compose --env-file .env.production -f compose.prod.yaml stop web
```

- `unauthorized`/`denied`: 패키지 이름·가시성·EC2의 PAT 읽기 권한·sudo 로그인 사용자 확인.
- `manifest unknown`: Actions 게시 성공 여부와 전체 SHA/digest 확인. `no matching manifest`는 아키텍처 게시 결과 확인.
- `unhealthy`: DB DNS/네트워크/인증/TLS와 마이그레이션 상태 확인. 컨테이너 내부 주소와 EC2 주소를 혼동하지 않는다.
- `ADMIN_AUTH_NOT_CONFIGURED`: issuer/audience 및 JWKS 둘 중 하나의 설정 확인. `403 ADMIN_REQUIRED`는 DB의 활성 관리자 subject 확인.
- Compose의 restart 정책은 프로세스 종료/호스트 재시작에 대응한다. **unhealthy 표시만으로 컨테이너가 재시작되지는 않는다.** 운영 모니터링은 별도로 구성한다.

## 검증 범위와 공식 자료

Phase 2-C는 배포 파일과 자동 빌드 경로를 준비하는 단계다. GHCR 게시 성공은 실제 GitHub Actions 실행 결과로, EC2 기동 성공은 실제 DB와 연결한 health 및 HTTPS 시험 결과로 별도 확인한다. AWS 자원 생성, GitHub push, 패키지 공개 범위 변경, 운영 DB 접속/변경, EC2 배포를 이 문서 작성만으로 수행한 것으로 보지 않는다.

로컬 검증 결과와 Docker 미설치로 인한 검증 한계는 [Phase 2-C 검증 기록](../verification/docker-ghcr-phase2c.md)에 정리했다.

- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [GitHub Actions Docker 이미지 게시](https://docs.github.com/en/actions/use-cases-and-examples/publishing-packages/publishing-docker-images)
- [GHCR 인증과 패키지 권한](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker 멀티 플랫폼 GitHub Actions](https://docs.docker.com/build/ci/github-actions/multi-platform/)
- [Compose 환경변수 치환](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
