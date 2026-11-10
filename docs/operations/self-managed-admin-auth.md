# SSH 운영자용 관리자 토큰 발급

기존 인증 제공자 설정을 인계받을 수 없어 새 서버에 별도 관리자 인증을 설정하는 절차다.
현재 앱의 RS256 검증과 `ADMIN_JWKS_JSON`을 사용하므로 웹 이미지 재빌드는 필요 없다.
외부 OIDC 로그인 서비스는 만들지 않으며 서버에 SSH로 접근할 수 있는 운영자가 토큰을 발급한다.
학교/개인 AWS IAM 로그인과 별개다. `web/scripts/demo-auth.mjs`는 운영에 사용하지 않는다.

## 구성과 보관

- `scripts/auth/admin-token.mjs init`: RSA 3072비트 키와 임의의 관리자 subject/issuer를 만들고 `.env.production`의 인증 항목만 설정한다. DB 비밀번호·작업 토큰·이미지 주소는 보존한다.
- 개인키와 식별 정보는 `.secrets/admin-auth/`에 보관한다. 디렉터리는 700, 개인키와 토큰 파일은 600이다. 개인키는 웹 컨테이너에 전달하지 않는다.
- 기존 실제 인증 설정은 덮어쓰지 않는다. 같은 설정으로 `init`을 재실행하면 기존 키와 subject를 유지한다.
- `issue`는 24시간짜리 토큰을 파일에 저장한다. 토큰을 재발급해도 이전 토큰은 만료 시점까지 유효하다. 이전 버전에서 발급한 1시간 토큰은 재발급해야 새 유효기간이 적용된다.
- 개인키를 잃으면 같은 관리자 토큰을 발급할 수 없다. 암호화된 별도 운영 백업에 보관한다. 개인키나 토큰을 Git, 채팅, 브라우저 번들에 넣지 않는다.
- 특정 관리자를 즉시 차단하려면 해당 `auth_subject`의 `is_active=false`로 설정한다. 키 유출 시 공개키 교체와 웹 재시작이 필요하다.

## EC2에서 실행

검토된 이미지를 이미 내려받았다면 다음 명령을 사용한다. 래퍼는 `.env.production`에서
이미지 주소만 읽고 셸 코드로 실행하지 않는다. 이미지가 없으면 자동 다운로드하지 않고 실패한다.

```bash
cd ~/simus
bash scripts/auth/run-admin.sh init
```

배포 디렉터리 `~/simus`에서 실행한다. `IMAGE`에는 이미 내려받은 검토 이미지의 digest 주소를 넣는다.
여기서 Docker는 이미지의 Node만 실행하고 네트워크에 연결하지 않는다. 운영 웹의 서비스나 포트는 시작하지 않는다.

```bash
cd ~/simus
IMAGE='ghcr.io/jeongsua-web/simus@sha256:REPLACE_WITH_REVIEWED_DIGEST'
sudo docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$PWD,dst=/ops" -w /ops \
  --entrypoint node "$IMAGE" scripts/auth/admin-token.mjs init
```

인증 설정 후 [최초 PostgreSQL 배포](ec2-postgres-first-deploy.md)에 따라 DB를 초기화한다.
현재 코드의 SQL 준비 도구가 검사한 순서를 사용하며 오래된 문서의 파일 목록을 직접 번호순 실행하지 않는다.
**기존 DB 복원이 아닌 새 DB 설치 절차**다. 초기화 실패 시 데이터 볼륨을 삭제하지 않는다.

DB가 정상 기동한 뒤 관리자 등록 SQL을 한 번 실행한다. 동일 subject가 존재해도 변경하거나 재활성화하지 않는다.

```bash
sudo docker compose --env-file .env.production -f compose.prod.yaml exec -T db \
  psql -X -U postgres -d simus -v ON_ERROR_STOP=1 \
  < .secrets/admin-auth/register-admin.sql
```

`bash scripts/auth/run-admin.sh issue` 또는 같은 Docker 실행 명령의 마지막 `init`을
`issue`로 바꾸면 토큰을 재발급한다.
운영자는 SSH 세션에서만 `cat .secrets/admin-auth/admin-token.txt`로 토큰을 확인해
**HTTPS** `/admin`에 붙여 넣는다. PuTTY 세션 로그를 사용한다면 토큰을 출력하지 말고
보호된 파일 전송으로 토큰 파일을 가져온다. 토큰을 채팅에 보내지 않는다.

이 설정만으로 HTTPS, 회차, 상황, 맵 좌표, NPC 경로 또는 자동 종료 스케줄러가 생성되지는 않는다.
신규 전시 콘텐츠를 기존 Neighborhood 좌표나 테스트 seed로 채우지 않는다.

## 검증

```powershell
node --test scripts/auth/admin-token.test.mjs
```

웹이 사용하는 `jose` 검증기로 발급 토큰을 검증하고 서명 변조, 다른 issuer/audience,
만료 토큰 거부, 기존 인증 설정 보호와 재실행 시 키 유지를 확인한다.
이 검증은 운영 DB에 접속하지 않는다.
