import type { PoolClient } from "pg";
import { ApiError } from "./api";

export type ProfileInput = { nickname: string; department_id: string; mbti: string };

export function parseProfile(input: Record<string, unknown>): ProfileInput {
  if (typeof input.nickname !== "string") throw new ApiError(400, "INVALID_NICKNAME", "닉네임을 입력하세요.");
  const nickname = input.nickname.normalize("NFC").trim().replace(/\s+/g, " ");
  const length = [...nickname].length;
  if (length < 2 || length > 10) throw new ApiError(400, "INVALID_NICKNAME", "닉네임은 2~10자로 입력하세요.");
  if (!/^[\p{L}\p{N} _.-]+$/u.test(nickname)) throw new ApiError(400, "INVALID_NICKNAME", "닉네임에는 글자, 숫자, 공백, _ . -만 쓸 수 있어요.");
  if (typeof input.department_id !== "string" || input.department_id === "none") throw new ApiError(400, "INVALID_DEPARTMENT", "목록에서 학과를 선택하세요.");
  if (typeof input.mbti !== "string" || !/^[EI][SN][TF][JP]$/.test(input.mbti)) throw new ApiError(400, "INVALID_MBTI", "MBTI 네 글자를 모두 선택하세요.");
  return { nickname, department_id: input.department_id, mbti: input.mbti };
}

// Session ordinal counts every started session, including rehearsals in the same database.
export async function readProfile(db: PoolClient, sessionId: string, participantId: string) {
  const result = await db.query(`SELECT p.profile_completed_at IS NOT NULL AS completed, p.nickname, p.mbti,
      p.department_id, d.name AS department_name,
      lpad((SELECT count(*) FROM simus.simulation_sessions o WHERE o.starts_at IS NOT NULL
        AND (o.starts_at,o.id) <= (s.starts_at,s.id))::text, 2, '0') || '-' ||
      lpad((SELECT count(*) FROM simus.participant_sessions q WHERE q.session_id=p.session_id
        AND q.profile_completed_at IS NOT NULL
        AND (q.profile_completed_at,q.participant_id) <= (p.profile_completed_at,p.participant_id))::text, 4, '0') AS citizen_no
    FROM simus.participant_sessions p
    JOIN simus.simulation_sessions s ON s.id=p.session_id
    JOIN simus.departments d ON d.id=p.department_id
    WHERE p.session_id=$1 AND p.participant_id=$2`, [sessionId, participantId]);
  if (!result.rowCount) return { joined: false, profile: null };
  const row = result.rows[0];
  if (!row.completed) return { joined: true, profile: null };
  return { joined: true, profile: {
    nickname: row.nickname as string, mbti: row.mbti as string, department_id: row.department_id as string,
    department_name: row.department_name as string, citizen_no: row.citizen_no as string,
  } };
}
