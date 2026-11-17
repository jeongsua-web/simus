# v003 Unity 로컬 빌드와 물리 검사

검토 씬은 `CityMasterplan_v003_EventPlaces.unity`이며 SHA-256은 `4b4e5dfbbf51b0754dd3de7435af67ef4670582994e7cf9cc10b7091123f6c27`이다. 테스트 버전은 `city-masterplan-v003-local-v1`과 `city-masterplan-v003-plaza30-v1`이다. 원본 씬·Blender·FBX·원본 Build Settings는 유지하고 격리 프로젝트의 파생 씬으로 빌드했다.

`FULL_EVENT_30_NPC_WAIT`의 XZ 위치를 사용한다. 저장된 앵커 높이 0.252m와 실제 경사 보행면 높이가 달라 Unity Raycast로 바닥 높이를 구하고 0.02m 여유를 더했다. 출발점 `[44.35,0.202832,65]`, 경유점 `[44.35,0.301893,72]`, 정지점 `[44.35,0.412014,79]`를 사용한다. 상자 중심 쪽의 `INTERACT`를 향해 NPC를 겹치게 배치하지 않는다. 서버 상호작용 반경은 0.6m이며 복귀 경로는 이 세 점의 역순이다.

Unity 6000.3.24f1에서 58개 표본의 바닥 지지와 반경 0.28m 신체 캡슐의 장애물 중첩을 검사했다. 지지 58개와 장애물 중첩 0개를 확인했다. 경로 길이는 14.0015669m이며 1.4m/s에서의 명목 이동 시간은 10.00112초다. 실제 웹 이동 시간과 결과 대기는 독립 QA 기록을 따른다. 물리 검사 원자료는 [v003-local-physics.json](v003-local-physics.json)에 있다.

참가자는 기존 Happiness Humanoid FBX와 `TestNpcWalk.controller`로 생성한다. `WebCityBridge`가 서버 위치·정지·재개 스냅샷을 적용하고 `NpcGrounding`이 실제 바닥에 시각 위치를 맞춘다. `CityPreviewCamera`는 본인 NPC를 추적한다. 이 빌드의 템플릿 생성에는 이전 University 맵을 불러오지 않는다.

## 메모리 수정과 결과

첫 32MiB 초기 힙 빌드는 실제 Chrome 시작 중 OOM과 `memory access out of bounds`가 관측됐다. 격리 프로젝트를 다시 만들고 초기 WASM 힙을 512MiB, 최대 힙을 2048MiB, 증가 모드를 Geometric으로 지정해 실제 재빌드했다. 원본 메시와 재질·충돌체는 유지했다. FBX의 `isReadable=0`과 씬의 static 플래그도 유지했다.

새 Wasm 바이너리의 memory section을 직접 해석해 초기 536,870,912바이트와 최대 2,147,418,112바이트를 확인했다. 최종 7개 산출물의 총 크기는 210,315,617바이트다. 메시의 비압축 크기는 약 600.9MB로 목표 모바일 기기 성능 검증이 남아 있다. 빌드 성공과 실제 브라우저 플레이 결과는 각각 빌드 보고서와 독립 QA에 기록한다.

- [최종 파일 해시·크기·메모리 설정](v003-webgl-build.json)
- [최종 Unity BuildReport](v003-local.buildreport)
- [초기 32MiB 빌드 기록](v003-webgl-build-initial32mb.json)
- [초기 Unity BuildReport](v003-local-initial32mb.buildreport)
- [독립 QA](v003-local-qa.md)

## 재현

저장소 루트에서 실행한다. Unity 6000.3.24f1과 대응하는 Web Build Support가 필요하다.

```sh
python3 scripts/unity/prepare-v003-local.py
SIMUS_V003_WEBGL_OUTPUT="$PWD/web/public/unity/city-masterplan-v003-local-v1" \
SIMUS_V003_AUDIT_OUTPUT="$PWD/docs/verification/v003-local-physics.json" \
/Applications/Unity/Hub/Editor/6000.3.24f1/Unity.app/Contents/MacOS/Unity \
  -batchmode -nographics -buildTarget WebGL -job-worker-count 2 \
  -projectPath /tmp/simus_v003_validation \
  -executeMethod CityMasterplanV003LocalBuild.Build \
  -quit -logFile /tmp/simus-v003-webgl-build.log
```

물리 검사만 반복할 때는 `-executeMethod CityMasterplanV003LocalBuild.Audit`를 사용한다. 준비 스크립트는 씬의 GUID 의존성을 수집하고 APFS 복제 기능을 사용해 격리 프로젝트를 만든다. Git LFS 포인터인 필수 모델이 있으면 가져올 경로를 출력한다. 빌더는 메모리·템플릿·압축 설정을 빌드 동안 적용한 뒤 복원한다.

현재 호스트의 WebGL 모듈은 공식 Unity 패키지 `4e7b9b5b6244`의 원본 실행 파일을 사용한다. 디스크 여유가 적었던 설치 시점에는 Development·멀티스레드·Wasm 2023 변형, PIC/LTO-PIC 캐시, 미사용 LLVM 개발 라이브러리와 도구를 제외했다. 이 빌드에 사용한 Single Thread·Wasm 2023 꺼짐 설정에서 컴파일과 링크를 완료했다. 모듈은 Unity의 `Contents/PlaybackEngines/WebGLSupport`에 보관했다.
