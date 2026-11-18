# 홈 화면 리디자인 검증 — 2026-11-17

## 변경 범위

- `web/src/app/page.tsx`: 기존 작업 중이던 영상/카드 구현을 이어서 보완. `/participate` 링크 유지, 자동 prefetch 비활성화. 장식 영상은 autoplay/muted/loop/playsInline, 로딩과 UI 분리. 동작 줄이기는 서버 기본 정적 화면에서 구독을 시작하고, 활성 시 video를 마운트하지 않는다. 설정 변경 시에도 반영하며 오류 시 video를 제거한다. 실제 재생 성공 후에만 멈춤/재생 버튼을 표시한다.
- `web/src/app/page.module.css`: 전체 화면 배경, WebP → 그라데이션 대체 배경, Dark Green 반투명/blur 카드, Vanilla 버튼, 모바일 및 키보드 포커스. 기존 CSS 도시 일러스트는 사용하지 않는다.
- `web/public/videos/city-background-poster.webp`: built-in ImageGen 정적 배경, 1672×941, 173286 bytes (169.2 KiB).
- `assets/library/ui/home_city_background_v001/`: 원본 PNG, 생성 프롬프트 2개, 출처/후속 연결 README.
- `assets/manifest.csv`: poster received / video planned 등록. 전시 승인 상태를 올리지 않았다.

작업 시작 전부터 홈 두 파일 및 참여/결과/NPC 관련 수정·이동·삭제가 있었다. 기존 변경을 보존했으며 이번 작업은 위 홈 화면과 신규 미디어/기록만 수정했다. `layout.tsx`, Unity, 실제 시뮬레이션, API, DB, 참여·관리자 화면 코드는 수정하지 않았다. Unity 실행도 하지 않았다.

## AI 제작 결과

Higgsfield Seedance 2.5 text-to-video에 8초·1080p·16:9·무음 1개를 요청했으나 `Requires plus plan or higher.`로 거절되었다. 제출된 생성 작업과 MP4 파일은 없다. 사전 견적 128 credits, 잔액 조회 7.73 credits / free plan. 별도 Genjutsu 무료 1회는 본 text-to-video 용도가 아니므로 사용하지 않았다.

정적 배경은 built-in ImageGen으로 별도 제작했고 Sharp WebP quality 80 / effort 6으로 배포본을 최적화했다. 영상 파일 크기는 해당 없음. 후속 영상의 제작·최적화·연결 안내와 전체 프롬프트는 `assets/library/ui/home_city_background_v001/README.md`에 있다.

## 실행한 검증

- `npm run build`: 통과. TypeScript와 전체 페이지 생성 포함.
- `npx eslint src/app/page.tsx --max-warnings 0`: 통과.
- `npx eslint src --format json`: 오류 0, 기존 `shared-result/page.tsx:44` 경고 1.
- `npm run lint`: 실패. 기존 Unity 배포 JavaScript를 포함해 오류 20 / 경고 907. 범위 밖 배포 파일과 lint 설정은 변경하지 않았다.
- Chrome 프로덕션 홈 시각 확인: 도시 배경, 카드 가독성, 중앙 정렬, Vanilla 버튼 확인.
- Chrome DevTools 320px × 696px 반응형 에뮬레이션: 카드/본문/버튼/주석이 잘리지 않고 표시됨.
- 참여 버튼 클릭: `/participate`로 정상 이동. 전체 참여/선택 제출 시나리오는 실행하지 않았다.
- Chrome DevTools `prefers-reduced-motion: reduce`: 새로고침 후 정적 배경 유지, 콘솔을 비운 뒤 영상 404 오류가 다시 발생하지 않음. 에뮬레이션은 검증 후 원복.
- 영상 없음: 일반 모드의 MP4 404 이후에도 정적 배경과 카드 표시, 멈춤 버튼 미표시 확인.
- HTTP 확인: `/`, `/participate`, poster 모두 200. poster Content-Type `image/webp`, 응답 크기 173286 bytes. 서버 HTML에 본문/참여 링크 존재, video 없음 (정적 기본값).
- `git diff --check`: 통과.
- `python3 scripts/assets/catalog.py`: 실패, 기존 manifest 해시 불일치 310건. 확인한 기존 Blender 파일은 Git LFS 포인터이며 실제 모델이 없는 상태다. 스크립트는 manifest 오류가 있으면 inventory를 쓰지 않으므로 inventory 갱신되지 않음.
- `python3 scripts/assets/catalog.py --check`: 실패, 기존 해시 불일치 310건 + stale inventory 1건. 신규 홈 항목의 경로/해시 오류는 출력되지 않았다. 기존 manifest 해시를 포인터 해시로 바꾸거나 검사 우회는 하지 않았다.

## 남은 검증/작업

- 사용 가능한 영상 생성 환경에서 MP4 제작 후 `web/public/videos/city-background.mp4`에 연결.
- 실제 영상의 H.264/30fps/무음/길이/크기/faststart 확인, 반복 경계, autoplay, 멈춤/재생, 실기기 확인.
- 실제 영상이 없으므로 반복 재생과 멈춤/재생의 동작 검증은 미실행. iOS/Android 실기기와 참여 전체 회귀 검증도 미실행.
- 이미지까지 실패하는 경우 그라데이션 대체는 코드에 구현했지만 브라우저에서 강제 실패 검증은 미실행.
- 기존 LFS 에셋의 실제 내용을 확보한 뒤 catalog 생성/검사 재실행 필요. 이번 홈 작업에서 대용량 기존 에셋 다운로드는 수행하지 않았다.
