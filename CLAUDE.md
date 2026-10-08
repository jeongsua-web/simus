# SIM:US 작업 지침

먼저 루트 [AGENTS.md](AGENTS.md)를 읽고 프로젝트 결정을 따른다. 하위 디렉터리의 추가 지침도 확인한다.

에셋 추가·변경·이동·정리 시 [에셋 정리 규칙](assets/ASSET_RULES.md)을 반드시 읽는다.
[에셋 탐색 목록](assets/catalog/README.md)에서 현재 보관 위치와 Unity 경로 예외를 확인한다.
파일 존재·이름을 전시 승인으로 해석하지 말고, 기존 사용자 변경 및 Unity `.meta`와 GUID를 보존한다.

작업 후 저장소 루트에서 실행한다.

```sh
python3 scripts/assets/catalog.py
python3 scripts/assets/catalog.py --check
```
