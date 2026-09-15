import { getPool } from "@/lib/db";
import { handle, json } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => {
    const result = await getPool().query(`SELECT s.id, s.name, s.status, s.starts_at, s.scheduled_end_at,
      s.scheduled_end_at-s.admission_buffer AS auto_cutoff_at,
      (s.status='RUNNING' AND s.starts_at <= clock_timestamp() AND s.admission_closed_at IS NULL
       AND clock_timestamp() < s.scheduled_end_at-s.admission_buffer) AS accepting_choices,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'code', t.code, 'title', t.title,
        'body', t.body, 'display_order', t.display_order, 'choices', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label, 'display_order', c.display_order)
            ORDER BY c.display_order, c.id) FROM simus.session_choices c
          WHERE c.session_id=t.session_id AND c.situation_id=t.id), '[]'::jsonb)) ORDER BY t.display_order, t.id)
        FROM simus.session_situations t WHERE t.session_id=s.id), '[]'::jsonb) AS situations
      FROM simus.simulation_sessions s WHERE s.status IN ('RUNNING','CLOSING') LIMIT 1`);
    return json({ session: result.rows[0] ?? null });
  });
}
