-- Apply once after 004. Preserve existing memberships and results.
BEGIN;
SET LOCAL search_path = simus, public;
CREATE TABLE departments (
  id text PRIMARY KEY,
  faculty text NOT NULL,
  name text NOT NULL,
  display_order integer NOT NULL UNIQUE
);
INSERT INTO departments(id,faculty,name,display_order) VALUES
('dept-01','산업디자인학부','영상디자인과',0),
('dept-02','산업디자인학부','시각디자인과',1),
('dept-03','산업디자인학부','패션디자인과',2),
('dept-04','산업디자인학부','헤어디자인전공',3),
('dept-05','산업디자인학부','스킨케어전공',4),
('dept-06','산업디자인학부','메이크업전공',5),
('dept-07','산업디자인학부','e스포츠과',6),
('dept-08','생명환경학부','환경조경학과',7),
('dept-09','생명환경학부','생태정원전공',8),
('dept-10','생명환경학부','플로리스트전공',9),
('dept-11','생명환경학부','정원문화산업전공',10),
('dept-12','생명환경학부','반려동물산업과',11),
('dept-13','생명환경학부','반려동물보건과',12),
('dept-14','생명환경학부','바이오생명과학과',13),
('dept-15','생명환경학부','유아교육학과',14),
('dept-16','생명환경학부','식품영양학과',15),
('dept-17','생명환경학부','호텔조리과',16),
('dept-18','생명환경학부','호텔제과제빵과',17),
('dept-19','정보미디어학부','사진영상콘텐츠과',18),
('dept-20','정보미디어학부','미디어콘텐츠과',19),
('dept-21','정보미디어학부','컴퓨터공학전공',20),
('dept-22','정보미디어학부','AI데이터전공',21),
('dept-23','정보미디어학부','게임콘텐츠과',22),
('dept-24','비즈니스실무학부','마케팅학과',23),
('dept-25','비즈니스실무학부','세무회계학과',24),
('dept-26','비즈니스실무학부','호텔관광과',25),
('dept-27','비즈니스실무학부','항공서비스과',26),
('dept-28','비즈니스실무학부','사회복지학과',27),
('dept-29','보건의료학부','간호학과(신설)',28),
('dept-30','보건의료학부','물리치료학과',29),
('dept-31','보건의료학부','방사선학과',30),
('dept-32','보건의료학부','치기공학과',31),
('dept-33','보건의료학부','치위생학과',32),
('dept-34','보건의료학부','작업치료학과',33),
('dept-35','보건의료학부','임상병리학과',34),
('dept-36','보건의료학부','보건의료행정학과',35),
('dept-37','보건의료학부','스포츠재활과',36),
('dept-38','보건의료학부','응급구조학과',37),
('dept-39','공간시스템학부','부동산지적학과',38),
('dept-40','공간시스템학부','실내건축과',39),
('dept-41','공간시스템학부','건축학과',40),
('dept-42','학부 지정 없음','자율전공학과',41),
('other','기타','기타',42),
('external','기타','외부 관람객',43),
('none','기타','선택 안 함',44);
ALTER TABLE participant_sessions ADD COLUMN department_id text NOT NULL DEFAULT 'none'
  REFERENCES departments(id) ON DELETE RESTRICT;
-- Use the same parent lock as choices, joins and lifecycle transitions.
CREATE FUNCTION guard_department_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    PERFORM 1 FROM simus.simulation_sessions WHERE id=OLD.session_id FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM simus.simulation_sessions WHERE id=OLD.session_id
      AND status='RUNNING' AND starts_at<=clock_timestamp() AND admission_closed_at IS NULL
      AND clock_timestamp()<scheduled_end_at-admission_buffer)
      OR EXISTS (SELECT 1 FROM simus.choice_records
        WHERE session_id=OLD.session_id AND participant_id=OLD.participant_id) THEN
      RAISE EXCEPTION 'Department is locked' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER department_change BEFORE UPDATE ON participant_sessions
  FOR EACH ROW EXECUTE FUNCTION guard_department_change();
REVOKE ALL ON departments FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION guard_department_change() FROM PUBLIC;
COMMIT;
