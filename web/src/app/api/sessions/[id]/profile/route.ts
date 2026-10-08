import { NextRequest } from "next/server";
import { ApiError, authenticate, body, checkOrigin, handle, json, requireOpen, transaction, uuid } from "@/lib/api";
import { joinSession } from "@/lib/participant-npcs";
import { parseProfile, readProfile } from "@/lib/participant-profiles";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  return handle(async () => {
    const sid = uuid((await context.params).id, "session_id");
    return json(await transaction(async db => {
      const pid = await authenticate(db, request);
      if (!pid) throw new ApiError(401, "UNAUTHORIZED", "참여 인증이 필요합니다.");
      const session = await db.query("SELECT id FROM simus.simulation_sessions WHERE id=$1", [sid]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      const departments = await db.query("SELECT id,faculty,name FROM simus.departments WHERE id<>'none' ORDER BY display_order");
      return { session_id: sid, ...await readProfile(db, sid, pid), departments: departments.rows };
    }));
  });
}

export async function POST(request: NextRequest, context: Context) {
  return handle(async () => {
    checkOrigin(request);
    const sid = uuid((await context.params).id, "session_id");
    const input = parseProfile(await body(request));
    const result = await transaction(async db => {
      const pid = await authenticate(db, request);
      if (!pid) throw new ApiError(401, "UNAUTHORIZED", "먼저 참여 인증을 준비해주세요.");
      // Same parent lock as joins and choices; it also serializes citizen numbers.
      const session = await db.query("SELECT id FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE", [sid]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      await joinSession(db, sid, pid);
      const prior = await readProfile(db, sid, pid);
      if (prior.profile) {
        const same = prior.profile.nickname === input.nickname && prior.profile.mbti === input.mbti
          && prior.profile.department_id === input.department_id;
        if (!same) throw new ApiError(409, "PROFILE_LOCKED", "입장한 뒤에는 닉네임·학과·MBTI를 바꿀 수 없습니다.");
        return { session_id: sid, profile: prior.profile, replayed: true };
      }
      await requireOpen(db, sid);
      const valid = await db.query("SELECT id FROM simus.departments WHERE id=$1 AND id<>'none'", [input.department_id]);
      if (!valid.rowCount) throw new ApiError(400, "INVALID_DEPARTMENT", "목록에서 학과를 선택하세요.");
      await db.query(`UPDATE simus.participant_sessions SET nickname=$3, mbti=$4, department_id=$5,
        profile_completed_at=clock_timestamp() WHERE session_id=$1 AND participant_id=$2`,
        [sid, pid, input.nickname, input.mbti, input.department_id]);
      await requireOpen(db, sid);
      return { session_id: sid, profile: (await readProfile(db, sid, pid)).profile, replayed: false };
    });
    return json(result, result.replayed ? 200 : 201);
  });
}
