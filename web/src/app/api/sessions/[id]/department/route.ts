import { NextRequest } from "next/server";
import { ApiError, authenticate, body, checkOrigin, handle, json, requireOpen, transaction, uuid } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  return handle(async () => {
    const sid = uuid((await context.params).id, "session_id");
    return json(await transaction(async db => {
      const pid = await authenticate(db, request);
      if (!pid) throw new ApiError(401, "UNAUTHORIZED", "참여 인증이 필요합니다.");
      const own = await db.query(`SELECT p.department_id,
        (s.status<>'RUNNING' OR s.starts_at>clock_timestamp() OR s.admission_closed_at IS NOT NULL
          OR clock_timestamp()>=s.scheduled_end_at-s.admission_buffer
          OR EXISTS (SELECT 1 FROM simus.choice_records r WHERE r.session_id=p.session_id
            AND r.participant_id=p.participant_id)) AS locked
        FROM simus.participant_sessions p JOIN simus.simulation_sessions s ON s.id=p.session_id
        WHERE p.session_id=$1 AND p.participant_id=$2`, [sid,pid]);
      if (!own.rowCount) throw new ApiError(404, "NOT_JOINED", "이 회차에 먼저 입장해주세요.");
      const departments = await db.query("SELECT id,faculty,name FROM simus.departments ORDER BY display_order");
      return { session_id: sid, ...own.rows[0], departments: departments.rows };
    }));
  });
}

export async function PUT(request: NextRequest, context: Context) {
  return handle(async () => {
    checkOrigin(request);
    const sid = uuid((await context.params).id, "session_id");
    const input = await body(request);
    if (typeof input.department_id !== "string") throw new ApiError(400, "INVALID_DEPARTMENT", "목록에서 학과를 선택해주세요.");
    return json(await transaction(async db => {
      const pid = await authenticate(db, request);
      if (!pid) throw new ApiError(401, "UNAUTHORIZED", "참여 인증이 필요합니다.");
      const session = await db.query("SELECT id FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE", [sid]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      await requireOpen(db, sid);
      const own = await db.query("SELECT department_id FROM simus.participant_sessions WHERE session_id=$1 AND participant_id=$2", [sid,pid]);
      if (!own.rowCount) throw new ApiError(404, "NOT_JOINED", "이 회차에 먼저 입장해주세요.");
      const valid = await db.query("SELECT id FROM simus.departments WHERE id=$1", [input.department_id]);
      if (!valid.rowCount) throw new ApiError(400, "INVALID_DEPARTMENT", "목록에서 학과를 선택해주세요.");
      const answered = await db.query("SELECT 1 FROM simus.choice_records WHERE session_id=$1 AND participant_id=$2 LIMIT 1", [sid,pid]);
      if (answered.rowCount) throw new ApiError(409, "DEPARTMENT_LOCKED", "첫 선택을 제출한 뒤에는 이 회차의 학과를 수정할 수 없습니다.");
      await db.query("UPDATE simus.participant_sessions SET department_id=$3 WHERE session_id=$1 AND participant_id=$2", [sid,pid,input.department_id]);
      await requireOpen(db, sid);
      return { session_id: sid, department_id: input.department_id, locked: false };
    }));
  });
}
