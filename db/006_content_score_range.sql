-- Expand new content's alignment range without changing existing session rows or rules.
BEGIN;
ALTER TABLE simus.session_choices DROP CONSTRAINT session_choices_check;
ALTER TABLE simus.session_choices ADD CONSTRAINT session_choices_alignment_range_check
  CHECK ((importance = 'NORMAL' AND alignment_dx BETWEEN -1 AND 1 AND alignment_dy BETWEEN -1 AND 1)
      OR (importance = 'MAJOR' AND alignment_dx BETWEEN -4 AND 3 AND alignment_dy BETWEEN -4 AND 3));
ALTER TABLE simus.choice_records DROP CONSTRAINT choice_records_alignment_dx_check;
ALTER TABLE simus.choice_records DROP CONSTRAINT choice_records_alignment_dy_check;
ALTER TABLE simus.choice_records ADD CONSTRAINT choice_records_alignment_range_check
  CHECK (alignment_dx BETWEEN -4 AND 3 AND alignment_dy BETWEEN -4 AND 3);
COMMIT;
