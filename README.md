# SIM:US 개발 환경

Docker Desktop 실행 후 저장소 최상위에서:

```sh
docker compose up
```

PostgreSQL이 준비되면 Next.js 의존성을 설치하고 개발 서버를 실행한다.
첫 실행에는 Node 이미지 다운로드와 패키지 설치 시간이 필요하다.
이미 별도로 실행한 `npm run dev`가 있으면 먼저 Ctrl+C로 종료한다.

- 참여 화면: http://localhost:3000/participate
- 연결 확인: http://localhost:3000/api/health
- 백그라운드 실행: `docker compose up -d`
- 상태 확인: `docker compose ps`
- 로그 확인: `docker compose logs -f web`
- 종료: 실행 터미널의 Ctrl+C 또는 `docker compose stop`

소스 수정은 컨테이너에 바로 반영된다. 패키지 파일을 바꿨다면
`docker compose restart web`으로 의존성을 다시 설치한다.
매 시작 시 `npm ci`로 lockfile과 설치 내용을 맞춘다.

Compose가 개발용 DATABASE_URL을 직접 제공하므로 Docker 실행에는 `.env.local`이 필요 없다.
Next.js를 컴퓨터에서 직접 실행할 때는 기존 `.env.local`의 localhost 주소를 사용한다.
컨테이너 안에서는 DB 주소가 `db:5432`이며 Next.js의 환경변수가 `.env.local`보다 우선한다.

DB 볼륨은 기존 것을 유지한다. 초기 SQL은 빈 DB 볼륨을 처음 만들 때만 적용된다.
일반 종료로 데이터가 삭제되지는 않지만 `docker compose down -v`는 DB 볼륨도 삭제하므로 사용에 주의한다.
개발 회차 데이터가 필요하면 `db/README.md`와 `web/API.md`를 참고한다.

이 Compose는 코드 변경을 즉시 반영하는 로컬 개발용 구성이다.
