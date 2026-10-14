# 시민증 캐릭터 정면 사진

최신 `models/SIMUS_Modular_Character_Happiness_Animations.blend`의 기존 모듈을 정면 렌더링했다. 원본·기존 장면은 수정하지 않았다.

- 기존 사진: `web/public/characters/npc_01.png`–`npc_16.png`, authored PREVIEW 변형. 이전 시민증 호환 보존.
- 꾸미기 사진: `web/public/characters/custom/npc_01_none.png`–`npc_16_round.png`, 16 헤어 × 안경 없음/사각/원형 48종, 384 × 480 PNG. 기존 BODY/OUTFIT/HAIR/GLASSES 모듈 직접 조합.
- 웹 계약: `web/src/lib/citizen-characters.ts`; `character_id`는 헤어, `glasses_id`는 `none`/`square`/`round`.
- 재생성: Blender background로 원본을 연 후 `scripts/characters/render_custom_citizen_portraits.py` 실행. 기존 16장의 재생성은 `render_citizen_portraits.py`.
- Unity 계약: `CitizenCharacterAppearance.Apply(actor, characterId, glassesId)`는 헤어와 안경을 독립 선택한다. 안경 ID가 없는 이전 자료는 01 사각/04 원형/그 외 없음으로 호환한다.
- 사진과 Unity는 동일 모델의 기존 모듈을 사용한다. 사진은 원본 재질, 런타임은 기존 Unity 템플릿 재질을 유지한다. 전시 승인·라이선스 확인 상태는 변경하지 않았다.
