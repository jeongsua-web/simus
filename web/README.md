# SIM:US Next.js

참여 `/participate`, 관리자 `/admin`, 본인 결과 `/result/{session_id}`와 API를 제공한다.

모바일의 목표, 화면별 역할, 구현 순서와 완료 기준은 [모바일 경험과 구현 계획](../docs/planning/mobile-experience.md)을 참고한다.

전체 실행 순서, DB 마이그레이션, 로컬 관리자 토큰 생성, 프로덕션 빌드·실행, 주소와 비밀 관리:
[시연·배포 가이드](../docs/operations/demo-deployment.md).

```powershell
npm ci
npm run lint
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

실행 전에 서버 DATABASE_URL과 관리자 환경 설정을 준비한다. 개발 실행은 `npm run dev`다.
`npm run test:integration`은 별도 PostgreSQL 바이너리와 프로덕션 빌드를 필요로 하며 새 격리 DB를 만든다.
기존 개발/운영 DB에 테스트를 실행하지 않는다.

[API 계약](API.md) · [운영 화면](OPERATIONS.md) · [검증 결과](../docs/verification/demo-validation.md)

모바일 도시 호스트와 Unity 빌드 연결: [웹–Unity 메시지 계약](../docs/contracts/web-unity-bridge.md). `/city/build.json` 및 계약을 구현한 `/city/index.html` 배포 전에는 도시 준비 안내를 표시한다.
