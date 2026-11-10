# EC2 최초 PostgreSQL 배포 승인안

상태: 로컬 구성 준비 및 정적 검토. **DB 마이그레이션 실행 테스트는 이번 배포에서 보류한다.** DB 생성·초기화, 컨테이너 실행, Git push, EC2 파일 전송·배포는 사용자 승인 전 실행하지 않는다. 아래는 승인 후 사람이 실행할 명령이며, 이 문서 자체는 실행 허가가 아니다.

대상은 Ubuntu EC2 t3.small(약 2GiB), Docker 29.1.3, Compose 2.40.3이다. GHCR 웹 이미지는 이미 다운로드된 상태를 전제로 한다. 기존 `compose.yaml`은 개발용으로 유지하며 운영 파일과 병합하지 않는다.

## 변경 파일

| 파일 | 변경 |
| --- | --- |
| `compose.prod.yaml` | PostgreSQL 16, 전용 내부 네트워크, named volume, 초기화 완료 확인, 리소스 제한 |
| `.env.example` | DB 관리자/앱 비밀번호와 운영 환경변수 예시 |
| `scripts/db/prepare-production.py` | 기존 managed runner의 SQL 계획을 오프라인 파일로 생성 |
| `scripts/db/init-production.sh` | 빈 PGDATA 최초 시작 때 계획 적용 및 앱 역할 권한 설정 |
| `.gitignore` | 생성 SQL `.prod-db/` 제외 |
| `.github/workflows/docker-publish.yml` | Compose 검증용 가상 DB 비밀번호 갱신; 실제 DB 실행 없음 |
| `docs/operations/docker-ghcr-ec2.md` | 기존 외부 DB 안내에서 이 최초 배포 절차로 연결 |
| 이 문서 및 `docs/verification/ec2-db-initialization-review.md` | 실행 순서·정적 검토 근거·운영 위험 |

이 작업 전부터 수정돼 있던 DB runner·016·체크섬·마이그레이션 문서는 기존 작업이다. 신규 초기화 SQL을 만들 때 그 파일들이 모두 필요하므로 함께 검토·전달해야 한다. SQL 원본 및 개발 Compose는 변경하지 않는다. 웹 이미지 재빌드는 필요 없다.

## Compose와 연결

- `db`: `postgres:16`, DB `simus`, 관리자 `postgres`. 데이터는 고정 이름 `simus_prod_postgres_data` named volume의 `/var/lib/postgresql/data`에 저장한다.
- DB에 host `ports`를 지정하지 않는다. `database` 네트워크는 `internal: true`이며 web/db만 참여한다. web은 외부 JWKS·푸시 서버 통신을 위해 기본 네트워크에도 참여한다.
- web의 URL은 Compose가 `postgresql://simus_app:<SIMUS_DB_PASSWORD>@db:5432/simus`로 조립한다. `.env.production`에 별도 `DATABASE_URL`을 적지 않는다.
- `simus_app`은 superuser/DB 생성/역할 생성 권한이 없는 로그인 역할이다. 스키마 소유자는 `postgres`로 두고 앱에는 `simus` 스키마 사용, 현재 테이블 CRUD, 시퀀스 및 함수 사용 권한을 부여한다. migration 이력 접근·DDL·TRUNCATE 권한은 부여하지 않는다. 업무 트리거의 제한은 계속 적용된다.
- DB 초기화와 앱 역할 설정을 마친 뒤 완료 표식을 기록하고, DB healthcheck가 TCP 준비와 이 표식을 확인한다. web은 `service_healthy` 이후 시작한다. 앱 `/api/health`만으로 전체 스키마가 검증되는 것은 아니다.

Compose는 서비스 이름으로 내부 DNS를 제공하며 host 포트 공개 없이 컨테이너 간 통신할 수 있다. [Docker 네트워크 문서](https://docs.docker.com/compose/how-tos/networking/)

## 신규 DB 초기화 경로

`prepare-production.py`는 `scripts/db/migrate.py`의 `sources()`·`plan()`을 사용해 원본 SHA-256을 확인하고 SQL을 생성한다. 이 단계는 PostgreSQL에 접속하거나 `psql`을 실행하지 않는다. 운영 서버의 Python 3만 필요하며 PostgreSQL 이미지에 Python을 설치하지 않는다.

적용 순서는 **001~011 → 013 → 016 → 015**다. 파일 glob이나 `001~015` 단순 번호순 실행을 사용하지 않는다.

- `012`: RUNNING 회차 공통 콘텐츠 보완용이므로 신규 스키마 필수가 아니며 제외한다.
- `014`: 기존 운영 결정에 따라 직접 실행하지 않는다. 빈 DB에서는 과거 행 backfill 문제 자체는 없지만, 앱이 요구하는 `glasses_id` 열과 프로필 보호 함수는 필요하므로 **대체 016을 포함**한다. 016을 빼고 015까지만 적용하면 현재 앱 계약을 충족하지 못한다.
- managed runner의 단일 트랜잭션·advisory lock·체크섬·`simus_migrations.history` 기록을 보존한다. 014를 적용한 것으로 기록하지 않는다. 016은 트랜잭션 안에서만 실행한다.
- 테스트/시연 seed 및 `verify_schema.sql`은 실행하지 않는다. 005의 학과 기준 데이터 45행과 migration 이력은 포함된다. 회차·운영 관리자·참가자·상황·좌표·NPC 경로는 생성하지 않는다. 새 전시 맵은 여전히 미확정이다.

PostgreSQL 공식 이미지의 초기화 스크립트는 **빈 데이터 디렉터리에서 한 번만** 실행된다. 기존 볼륨에는 SQL 파일 변경이나 비밀번호 환경변수 변경이 자동 적용되지 않는다. 초기화 도중 실패하면 다음 재시작이 스크립트를 재실행하지 않을 수 있다. 완료 표식이 없으면 web 시작을 차단하고, 볼륨을 보존한 채 로그와 DB 상태를 검토해 별도 복구 승인을 받는다. 자동 재시도·삭제·수동 원본 SQL 재실행으로 해결하지 않는다. [공식 이미지 초기화 동작](https://hub.docker.com/_/postgres)

## 승인 후 파일 준비와 환경변수

EC2에 같은 검토 버전의 파일을 전달한다. 다음 명령은 로컬 저장소 루트에서 **승인 후** 실행한다. 실제 DNS와 키 경로를 바꾼다. 기존 GHCR 이미지 다운로드는 반복할 필요 없다.

```sh
ssh -i /path/to/ec2-key.pem ubuntu@EC2_PUBLIC_DNS 'mkdir -p ~/simus/scripts/db && chmod 700 ~/simus'
scp -i /path/to/ec2-key.pem compose.prod.yaml .env.example ubuntu@EC2_PUBLIC_DNS:~/simus/
scp -i /path/to/ec2-key.pem -r db ubuntu@EC2_PUBLIC_DNS:~/simus/
scp -i /path/to/ec2-key.pem scripts/db/migrate.py scripts/db/prepare-production.py scripts/db/init-production.sh ubuntu@EC2_PUBLIC_DNS:~/simus/scripts/db/
```

`db/`에는 체크섬 manifest와 대체 016도 포함돼야 한다. seed 파일이 함께 전달되더라도 실행 계획에 포함되지 않는다. 이 명령은 Git push 없이 파일을 전달하는 방법이며 아직 실행하지 않았다.

이후 EC2에서:

```sh
cd ~/simus
cp -n .env.example .env.production
chmod 600 .env.production
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
nano .env.production
python3 scripts/db/prepare-production.py --output-dir .prod-db
sudo docker compose --env-file .env.production -f compose.prod.yaml config --quiet
sudo docker volume ls --filter name=simus_prod_postgres_data
free -h
df -h /var/lib/docker
```

위 난수 세 개는 순서대로 서로 다른 `POSTGRES_PASSWORD`, `SIMUS_DB_PASSWORD`, `SESSION_JOB_TOKEN`으로 저장한다. 실제 비밀번호를 채팅·명령 인자·Git·로그에 남기지 않는다. hex 문자열은 URL 인코딩 없이 앱 URL에 넣을 수 있다. 인증 issuer/audience 및 JWKS 한 종류도 실제 값으로 교체하고 `SIMUS_IMAGE`는 다운로드한 SHA 태그 또는 digest로 지정한다. `.env.production`을 shell `source`로 실행하지 않는다. 셸에 export된 동명 변수는 env 파일보다 우선하므로 의도한 값인지 확인한다. `config` 전체 출력에는 비밀값이 있으므로 `--quiet`를 사용한다.

동일 이름 볼륨이 이미 표시되면 신규 빈 DB라는 전제가 성립하는지 먼저 확인하고 시작을 멈춘다. 생성 SQL은 비밀값을 포함하지 않지만 배포 코드이므로 일반 사용자에게 쓰기 권한을 주지 않는다. 디렉터리/파일은 컨테이너 postgres 사용자가 읽을 수 있어야 한다.

## 승인 후 실제 DB 초기화·실행

**다음 첫 `up`이 운영 DB 생성과 초기화를 수행한다.** 실행 테스트를 보류한 상태에서 운영 초기화를 진행한다는 점까지 승인 범위에 포함해야 한다.

```sh
cd ~/simus
sudo docker compose --env-file .env.production -f compose.prod.yaml pull db
sudo docker compose --env-file .env.production -f compose.prod.yaml up -d --no-build --wait --wait-timeout 180 db
sudo docker compose --env-file .env.production -f compose.prod.yaml exec -T db psql -X -U postgres -d simus -v ON_ERROR_STOP=1 -c 'SELECT version, origin FROM simus_migrations.history ORDER BY applied_at, version;'
sudo docker compose --env-file .env.production -f compose.prod.yaml up -d --no-build --wait --wait-timeout 120 web
sudo docker compose --env-file .env.production -f compose.prod.yaml ps
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
sudo docker stats --no-stream
```

기대 이력은 001~011, 013, 016, 015의 14건이며 모두 `executed`다. 012/014는 포함하지 않는다. health는 `status=healthy`, `database=simus`여야 한다. 이 확인은 보류한 마이그레이션 시나리오 테스트를 대체하지 않는다. 생성 artifact가 이미 있으면 준비 도구가 덮어쓰기를 거절하므로 기존 파일을 보존하고 검토한다.

문제 확인과 비파괴 중지는 다음 명령을 사용한다. 초기화 실패 시 web은 올리지 않는다.

```sh
sudo docker compose --env-file .env.production -f compose.prod.yaml logs --tail 100 db web
sudo docker compose --env-file .env.production -f compose.prod.yaml stop web db
```

운영 관리자 subject 등록·실제 전시 콘텐츠 준비·HTTPS 프록시·reconcile 주기 작업은 별도 운영 설정이다. 빈 DB 초기화만으로 관리자 로그인이나 전시 회차 시작이 준비되는 것은 아니다. 웹 포트는 기본 loopback 3000이며 보안 그룹에서 DB 5432를 열지 않는다.

## 2GiB 자원 예산과 운영 위험

| 항목 | 초기 설정/의미 |
| --- | --- |
| web | 메모리 상한 768MiB, Node old heap 512MiB, CPU 1개 상한 |
| PostgreSQL | 메모리 상한 512MiB, CPU 1개 상한, shared memory 128MiB |
| DB 내부 | shared_buffers 128MB, work_mem 2MB, maintenance_work_mem 32MB, max_connections 30, 병렬 쿼리 worker 0 |
| 앱 연결 | 현 이미지 pool 최대 10개; web 1개 운영 전제 |
| 호스트 여유 | 컨테이너 상한 합계 1280MiB 외 약 768MiB를 OS/Docker/프록시 등에 사용; 예약 보장이나 부하 검증 결과가 아님 |
| 로그 | 서비스별 10MB × 3개 회전. DB 데이터/WAL/임시 파일에는 이 제한이 적용되지 않음 |

이는 작은 인스턴스용 시작 예산이며 동시 접속 수를 보장하지 않는다. `mem_limit`은 실제 컨테이너 상한이고, Node heap 상한은 전체 RSS 상한이 아니다. DB의 `work_mem`은 연결당 고정 1회 배정이 아니라 쿼리의 여러 연산/동시 세션에서 중첩될 수 있다. [Compose 자원 설정](https://docs.docker.com/reference/compose-file/services/), [PostgreSQL 메모리 설명](https://www.postgresql.org/docs/16/runtime-config-resource.html)

- OOM 종료·GC 정체·DB 재시작 및 연결 끊김 위험이 있다. heap·shared buffers만 더해 사용량을 예측하지 않는다. EC2에서 앱 빌드하지 않고 GHCR 이미지를 사용한다. swap은 현재 존재 여부만 확인하며 이 변경으로 생성하지 않는다.
- t3는 CPU credit 기반이다. Standard에서 credit 소진 시 성능 저하, Unlimited에서 지속 초과 사용 시 추가 비용 가능성이 있다. CPUCreditBalance·CPUSurplusCreditBalance·CPU 및 실제 credit mode를 확인한다. [AWS Standard](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-performance-instances-standard-mode-concepts.html), [AWS Unlimited](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-performance-instances-unlimited-mode.html)
- 같은 EC2에 앱과 DB를 두므로 인스턴스/디스크 장애 시 함께 중단된다. named volume은 컨테이너 재생성 후 데이터를 유지하지만 백업이나 고가용성을 제공하지 않는다. EBS 암호화·인스턴스 종료 시 볼륨 보존 정책·외부 백업과 복원 계획을 확인한다.
- Docker 디스크 사용량, EBS 여유, DB/WAL 증가, 메모리, 연결 수, unhealthy 상태를 모니터링한다. restart 정책은 프로세스 종료에 반응하며 unhealthy 표시만으로 자동 복구하지 않는다.
- `postgres:16`은 같은 major 안에서 변경 가능한 태그다. 실제 배포 이미지 digest를 기록하고 이후 갱신은 계획적으로 수행한다. major 버전 변경은 같은 데이터 볼륨으로 단순 교체하지 않는다.
- 앱의 현재 CRUD/함수 권한은 전체 `simus` 범위이므로 행 수준 최소 권한까지 구현한 것은 아니다. 새 migration 이후 권한 갱신도 별도 검토한다. Docker 운영 권한과 `.env.production` 접근 권한은 관리자에게 제한한다.
- DB 실행·마이그레이션·앱 역할 통합 검증은 미수행이다. 정적 검토로만 성공을 보증할 수 없으며 승인 후 초기화 실패 시 운영 시작이 지연될 수 있다.
