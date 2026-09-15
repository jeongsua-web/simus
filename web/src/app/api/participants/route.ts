import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { authenticate, checkOrigin, handle, hashToken, json, participantCookie, transaction } from "@/lib/api";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return handle(async () => {
    checkOrigin(request);
    const result = await transaction(async db => {
      const existing = await authenticate(db, request);
      if (existing) {
        await db.query("UPDATE simus.participants SET last_seen_at=clock_timestamp() WHERE id=$1", [existing]);
        return { participant_id: existing, token: null };
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
