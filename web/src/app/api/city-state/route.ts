import { getPool } from "@/lib/db";
import { handle, json } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => {
    // One statement keeps city, version, and regions on the same database snapshot.
    const result = await getPool().query(`SELECT s.id AS session_id, s.status, c.happiness::float8,
      c.safety::float8, c.cleanliness::float8, c.version::text, c.updated_at,
      p.overall_pollution::float8, COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'code', r.code, 'name', r.name, 'map_metadata', r.map_metadata,
        'pollution', rs.pollution::float8, 'updated_at', rs.updated_at) ORDER BY r.code)
        FROM simus.session_regions r JOIN simus.region_states rs
        ON rs.session_id=r.session_id AND rs.region_id=r.id WHERE r.session_id=s.id), '[]'::jsonb) AS regions
      FROM simus.simulation_sessions s JOIN simus.city_states c ON c.session_id=s.id
      LEFT JOIN simus.overall_pollution p ON p.session_id=s.id
      WHERE s.status IN ('RUNNING','CLOSING','FINALIZED')
      ORDER BY CASE WHEN s.status IN ('RUNNING','CLOSING') THEN 0 ELSE 1 END, s.finalized_at DESC NULLS LAST LIMIT 1`);
    return json({ city_state: result.rows[0] ?? null });
  });
}
