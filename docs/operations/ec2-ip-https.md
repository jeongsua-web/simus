# EC2 퍼블릭 IP의 HTTPS 설정

## 2026-11-10 새 계정 배포 기록

기존 계정에 접근할 수 있는지 확인되지 않은 상태에서 새 AWS 계정에 신규 배포했다.
기존 운영 DB의 백업·복원이나 기존 AWS 자원의 삭제는 이 절차에서 수행하지 않았다.

- 배포 기준 커밋: `3dd2ce47ce34569d67c831bc994bb5be8129b4ca`.
- 웹 이미지: `ghcr.io/jeongsua-web/simus@sha256:37adf60546759630f9781459a44a5849aa58fe3874dbd2d23c9a97278bc3075d`.
- 사용자가 확인한 당시 주소: `https://3.35.171.254`.
- 사용자가 전달한 health 결과: `status=healthy`, `database=simus`, `table_count=25`.
- Caddy 로그에서 해당 IP의 Let's Encrypt 인증서 발급 성공을 확인했다.
- 최초 TLS 접속 오류 후 `default_sni` 설정을 안내했고, 이후 사용자가 사이트 접속을 확인했다.
- 웹 관리자 인증은 [SSH 운영자용 관리자 토큰](self-managed-admin-auth.md)을 새로 구성했다. 새로 발급하는 토큰은 24시간 유효하다.

주소와 배포 이미지는 이 기록 시점의 값이다. 이후 배포나 IP 변경 시 실제 운영 값을 다시 확인한다.
웹 접속 성공이 전시 콘텐츠, 회차, NPC 경로, 자동 종료 작업 또는 기존 데이터 이전 완료를 뜻하지 않는다.

## 접속 구조

클라이언트 HTTPS 443 → 호스트 Caddy → `127.0.0.1:3000` → 웹 컨테이너 → 내부 PostgreSQL 컨테이너.

운영 Compose는 `compose.prod.yaml`을 단독으로 사용한다. 웹 바인딩은
`SIMUS_BIND_ADDRESS=127.0.0.1`을 유지하고 3000과 5432를 인터넷에 공개하지 않는다.
보안 그룹은 HTTP TCP 80, HTTPS TCP 443을 공개하며 SSH 22는 운영자 IP로 제한한다.
HTTP 80은 인증서 HTTP-01 검증과 HTTPS 리다이렉트에 사용한다.

## Caddy 설치

[Caddy 공식 Ubuntu 설치 절차](https://caddyserver.com/docs/install#debian-ubuntu-raspbian)를 따른다.
Ubuntu 기본 저장소의 구버전 대신 공식 stable 저장소를 등록한다.

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
caddy version
```

## Caddyfile

다음은 해당 배포에서 안내한 `/etc/caddy/Caddyfile`이다. 다른 서버에서는 두 IP를 모두 바꾼다.
IP로 접속하는 클라이언트가 SNI를 보내지 않는 경우에도 인증서를 선택하도록
[`default_sni`](https://caddyserver.com/docs/caddyfile/options#default-sni)를 지정한다.
IP 인증서는 Let's Encrypt의 `shortlived` 프로필을 사용하며 Caddy가 갱신을 관리한다.

```caddyfile
{
    default_sni 3.35.171.254
}

https://3.35.171.254 {
    tls {
        issuer acme {
            dir https://acme-v02.api.letsencrypt.org/directory
            profile shortlived
            disable_tlsalpn_challenge
        }
    }
    reverse_proxy 127.0.0.1:3000
}
```

기존 Caddy 설정을 보존하고 위 내용을 적용한 후 검증한다. `Valid configuration`이 나올 때만 reload한다.

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
curl --fail --silent --show-error https://3.35.171.254/api/health
```

인증서 발급은 비동기이므로 발급 완료 전에는 TLS 오류가 날 수 있다. 완료 후에도
오류가 지속되면 `default_sni`와 최신 로그를 확인한다. TLS 검증을 끄는 `curl -k`로 성공 처리하지 않는다.

```bash
sudo journalctl -u caddy --no-pager -n 40
```

## Git과 서버 설정의 구분

관리자 발급 도구와 이 문서는 Git으로 관리한다. 서버의 실제 `.env.production`,
`.secrets/`, 관리자 토큰, SSH 키, PostgreSQL 데이터 볼륨, Caddy의 인증서 개인키는 Git에 올리지 않는다.
이 문서의 설정 예시는 인증서 개인키를 포함하지 않는다.
`builds/ec2/`의 전송용 압축 파일은 Git 제외 대상이며 원본 코드와 문서에서 다시 준비할 수 있다.
Git push만으로 현재 EC2의 파일이나 실행 이미지가 자동 변경되지는 않는다.
