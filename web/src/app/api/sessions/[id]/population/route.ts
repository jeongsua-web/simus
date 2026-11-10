import { NextRequest } from "next/server";
import { ApiError, authenticate, checkOrigin, handle, json, transaction, uuid } from "@/lib/api";
import type { PoolClient } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function readPopulation(db: PoolClient, sessionId: string) {
  const result = await db.query(`SELECT s.id AS session_id,
      (SELECT count(*)::int FROM simus.participant_sessions ps
        JOIN simus.participants p ON p.id=ps.participant_id
        WHERE ps.session_id=s.id AND ps.profile_completed_at IS NOT NULL
          AND s.status IN ('RUNNING','CLOSING')
          AND p.last_seen_at > clock_timestamp()-interval '45 seconds'
          AND EXISTS (SELECT 1 FROM simus.participant_credentials c
            WHERE c.participant_id=p.id AND c.revoked_at IS NULL
              AND (c.expires_at IS NULL OR c.expires_at > clock_timestamp()))) AS online_count
    FROM simus.simulation_sessions s WHERE s.id=$1`, [sessionId]);
  if (!result.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
  return result.rows[0];
}

export async function GET(_request: NextRequest, context: Context) {
  return handle(async () => {
    const sid = uuid((await context.params).id, "session_id");
    return json(await transaction(db => readPopulation(db, sid)));
  });
}

export async function POST(request: NextRequest, context: Context) {
  return handle(async () => {
    checkOrigin(request);
    const sid = uuid((await context.params).id, "session_id");
    return json(await transaction(async db => {
      const pid = await authenticate(db, request);
      if (!pid) throw new ApiError(401, "UNAUTHORIZED", "참여 인증이 필요합니다.");
      const session = await db.query("SELECT id FROM simus.simulation_sessions WHERE id=$1", [sid]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      const member = await db.query(`SELECT 1 FROM simus.participant_sessions
        WHERE session_id=$1 AND participant_id=$2 AND profile_completed_at IS NOT NULL`, [sid, pid]);
      if (!member.rowCount) throw new ApiError(403, "PROFILE_REQUIRED", "시민 등록을 완료해 주세요.");
      await db.query(`UPDATE simus.participants SET last_seen_at=clock_timestamp()
        WHERE id=$1 AND EXISTS (SELECT 1 FROM simus.simulation_sessions
          WHERE id=$2 AND status IN ('RUNNING','CLOSING'))`, [pid, sid]);
      return readPopulation(db, sid);
    }));
  });
}
