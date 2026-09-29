import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { ApiError, authenticate, checkOrigin, handle, hashToken, json, participantCookie, transaction } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const payload = await transaction(async db => {
      const participantId = await authenticate(db, request);
      if (!participantId) throw new ApiError(401, "UNAUTHORIZED", "참여 인증이 만료되었거나 유효하지 않습니다.");
      const latest = await db.query(`SELECT s.id, s.name, s.status, s.starts_at, s.scheduled_end_at,
          s.finalized_at, count(r.id)::int AS response_count,
          (SELECT count(*)::int FROM simus.session_situations t WHERE t.session_id=s.id) AS situation_count
        FROM simus.participant_sessions ps
        JOIN simus.simulation_sessions s ON s.id=ps.session_id
        LEFT JOIN simus.choice_records r ON r.session_id=ps.session_id AND r.participant_id=ps.participant_id
        WHERE ps.participant_id=$1
        GROUP BY s.id, ps.joined_at
        ORDER BY ps.joined_at DESC, s.id`, [participantId]);
      return { latest_session: latest.rows[0] ?? null, history: latest.rows.filter(row => row.status === "FINALIZED") };
    });
    return json(payload);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    checkOrigin(request);
    const result = await transaction(async db => {
      const existing = await authenticate(db, request);
      if (existing) {
        await db.query("UPDATE simus.participants SET last_seen_at=clock_timestamp() WHERE id=$1", [existing]);
        return { participant_id: existing, token: null };
      }
      if (request.cookies.has(participantCookie)) {
        throw new ApiError(401, "PARTICIPANT_AUTH_EXPIRED", "참여 인증이 만료되었습니다. 브라우저의 사이트 데이터를 지운 뒤 새 참여를 시작해 주세요.");
      }
      const token = randomBytes(32).toString("hex");
      const participant = await db.query("INSERT INTO simus.participants DEFAULT VALUES RETURNING id");
      const id = participant.rows[0].id as string;
      await db.query(`INSERT INTO simus.participant_credentials(participant_id,token_hash,expires_at)
        VALUES ($1,$2,clock_timestamp()+interval '30 days')`, [id, hashToken(token)]);
      return { participant_id: id, token };
    });
    const response = json({ participant_id: result.participant_id }, result.token ? 201 : 200);
    if (result.token) response.cookies.set(participantCookie, result.token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86400,
    });
    return response;
  });
}
