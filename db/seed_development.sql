-- 로컬 개발용 테스트 데이터
BEGIN;
SET LOCAL search_path = simus, public;

-- 개발용 관리자
INSERT INTO admin_users (
  id,
  auth_subject,
  display_name
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev-admin',
  '개발 관리자'
)
ON CONFLICT (id) DO NOTHING;

-- 테스트 회차
INSERT INTO simulation_sessions (
  id,
  name,
  status,
  scheduled_end_at,
  admission_buffer,
  expected_participants,
  expected_answers_per_person,
  impact_scale,
  rules_snapshot,
  created_by_admin_id
)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '개발 테스트 회차',
  'DRAFT',
  now() + interval '7 days',
  interval '5 seconds',
  10,
  1,
  1,
  '{
    "version": 1,
    "alignment_thresholds": {
      "negative": -3,
      "positive": 3
    },
    "alignment_axes": {
      "x": {"negative": "CHAOTIC", "positive": "LAWFUL"},
      "y": {"negative": "EVIL", "positive": "GOOD"}
    },
    "interpretations": {
      "LAWFUL_GOOD": "질서 선",
      "LAWFUL_NEUTRAL": "질서 중립",
      "LAWFUL_EVIL": "질서 악",
      "NEUTRAL_GOOD": "중립 선",
      "TRUE_NEUTRAL": "완전 중립",
      "NEUTRAL_EVIL": "중립 악",
      "CHAOTIC_GOOD": "혼돈 선",
      "CHAOTIC_NEUTRAL": "혼돈 중립",
      "CHAOTIC_EVIL": "혼돈 악"
    },
    "initial_city_state": {
      "happiness": 50,
      "safety": 50,
      "cleanliness": 50
    },
    "initial_region_pollution": {"CENTER": 0},
    "zero_response_policy": "EXCLUDE",
    "completion_policy": "DRAIN"
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- 테스트 지역
INSERT INTO session_regions (
  session_id,
  id,
  code,
  name,
  aggregation_weight
)
SELECT
  s.id,
  '20000000-0000-0000-0000-000000000001',
  'CENTER',
  '중앙 구역',
  1
FROM simulation_sessions s
WHERE s.id = '10000000-0000-0000-0000-000000000001'
  AND s.status = 'DRAFT'
ON CONFLICT (session_id, id) DO NOTHING;

-- 테스트 상황
INSERT INTO session_situations (
  session_id,
  id,
  code,
  title,
  body,
  display_order
)
SELECT
  s.id,
  '30000000-0000-0000-0000-000000000001',
  'TRASH_001',
  '길가에 쓰레기가 놓여 있다',
  '지나가던 중 길가에 버려진 쓰레기를 발견했습니다. 어떻게 행동할까요?',
  1
FROM simulation_sessions s
WHERE s.id = '10000000-0000-0000-0000-000000000001'
  AND s.status = 'DRAFT'
ON CONFLICT (session_id, id) DO NOTHING;

-- 선택지 두 개
INSERT INTO session_choices (
  session_id,
  situation_id,
  id,
  label,
  display_order,
  importance,
  alignment_dx,
  alignment_dy,
  happiness_base,
  safety_base,
  cleanliness_base
)
SELECT
  s.id,
  '30000000-0000-0000-0000-000000000001',
  choice_data.id,
  choice_data.label,
  choice_data.display_order,
  'NORMAL',
  choice_data.alignment_dx,
  choice_data.alignment_dy,
  choice_data.happiness_base,
  choice_data.safety_base,
  choice_data.cleanliness_base
FROM simulation_sessions s
CROSS JOIN (
  VALUES
    (
      '40000000-0000-0000-0000-000000000001'::uuid,
      '쓰레기를 분리배출한다',
      1,
      1::smallint,
      1::smallint,
      1::numeric,
      0::numeric,
      4::numeric
    ),
    (
      '40000000-0000-0000-0000-000000000002'::uuid,
      '쓰레기를 그대로 두고 간다',
      2,
      -1::smallint,
      -1::smallint,
      -1::numeric,
      0::numeric,
      -5::numeric
    )
) AS choice_data(
  id,
  label,
  display_order,
  alignment_dx,
  alignment_dy,
  happiness_base,
  safety_base,
  cleanliness_base
)
WHERE s.id = '10000000-0000-0000-0000-000000000001'
  AND s.status = 'DRAFT'
ON CONFLICT (session_id, situation_id, id) DO NOTHING;

-- 선택지별 지역 오염 영향
INSERT INTO choice_region_effects (
  session_id,
  situation_id,
  choice_id,
  region_id,
  pollution_base
)
SELECT
  s.id,
  '30000000-0000-0000-0000-000000000001',
  effect.choice_id,
  '20000000-0000-0000-0000-000000000001',
  effect.pollution_base
FROM simulation_sessions s
CROSS JOIN (
  VALUES
    (
      '40000000-0000-0000-0000-000000000001'::uuid,
      -3::numeric
    ),
    (
      '40000000-0000-0000-0000-000000000002'::uuid,
      4::numeric
    )
) AS effect(choice_id, pollution_base)
WHERE s.id = '10000000-0000-0000-0000-000000000001'
  AND s.status = 'DRAFT'
ON CONFLICT (
  session_id,
  situation_id,
  choice_id,
  region_id
) DO NOTHING;

-- 도시와 지역 초기 상태
INSERT INTO city_states (session_id)
VALUES ('10000000-0000-0000-0000-000000000001')
ON CONFLICT (session_id) DO NOTHING;

INSERT INTO region_states (
  session_id,
  region_id
)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001'
)
ON CONFLICT (session_id, region_id) DO NOTHING;

-- 콘텐츠 생성이 끝난 뒤 회차 시작
UPDATE simulation_sessions
SET
  status = 'RUNNING',
  starts_at = now()
WHERE id = '10000000-0000-0000-0000-000000000001'
  AND status = 'DRAFT';

COMMIT;
