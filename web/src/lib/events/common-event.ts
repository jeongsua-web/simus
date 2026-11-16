import type { PoolClient } from "pg";

// Authored, location-independent fallback. Neutral effects avoid inventing score
// policy for the exhibition; operators can replace it with scored DRAFT content.
export async function ensureCommonEvent(db: PoolClient, sessionId: string) {
  const existing = await db.query(`SELECT 1 FROM simus.session_situations t
    WHERE t.session_id=$1 AND t.is_generic AND t.event_location IS NULL
    AND (SELECT count(*) FROM simus.session_choices c WHERE c.session_id=t.session_id AND c.situation_id=t.id)>=2`, [sessionId]);
  if (existing.rowCount) return;
  const situation = await db.query(`INSERT INTO simus.session_situations(session_id,code,title,body,display_order,is_generic)
    VALUES($1,'SIMUS_COMMON_ENCOUNTER','이웃의 인사','도시를 걷던 중 이웃이 가볍게 인사를 건넵니다. 어떻게 반응할까요?',2147483647,true) RETURNING id`, [sessionId]);
  await db.query(`INSERT INTO simus.session_choices(session_id,situation_id,label,display_order,importance)
    VALUES($1,$2,'인사를 나눈다.',1,'NORMAL'),($1,$2,'가볍게 고개를 끄덕이고 걷는다.',2,'NORMAL')`, [sessionId, situation.rows[0].id]);
}
