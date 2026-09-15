import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getPool } from "./db";

export const participantCookie = "simus_participant";
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export async function handle(action: () => Promise<NextResponse>) {
  try { return await action(); } catch (error) {
    if (error instanceof ApiError) return json({ error: { code: error.code, message: error.message } }, error.status);
    console.error("API request failed", error);
    return json({ error: { code: "INTERNAL_ERROR", message: "요청 처리에 실패했습니다." } }, 500);
  }
}
export async function transaction<T>(action: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await getPool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SET LOCAL lock_timeout = '5s'");
    await db.query("SET LOCAL statement_timeout = '10s'");
    const result = await action(db);
    await db.query("COMMIT");
    return result;
  } catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
}
export function checkOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    throw new ApiError(403, "INVALID_ORIGIN", "같은 사이트에서 요청해주세요.");
  }
}
export async function body(request: NextRequest): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new ApiError(415, "INVALID_CONTENT_TYPE", "JSON 본문이 필요합니다.");
  let value: unknown;
  try { value = await request.json(); } catch { throw new ApiError(400, "INVALID_JSON", "올바른 JSON이 아닙니다."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "INVALID_BODY", "JSON 객체가 필요합니다.");
  return value as Record<string, unknown>;
}
export function uuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400, "INVALID_ID", `${name}는 UUID여야 합니다.`);
  return value.toLowerCase();
}
export async function authenticate(db: PoolClient, request: NextRequest) {
  const token = request.cookies.get(participantCookie)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const result = await db.query(`SELECT participant_id FROM simus.participant_credentials
    WHERE token_hash=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > clock_timestamp())`, [hashToken(token)]);
  return result.rows[0]?.participant_id as string | undefined ?? null;
}
export async function requireOpen(db: PoolClient, sessionId: string) {
  const result = await db.query(`SELECT id FROM simus.simulation_sessions WHERE id=$1
    AND status='RUNNING' AND starts_at <= clock_timestamp() AND admission_closed_at IS NULL
    AND clock_timestamp() < scheduled_end_at - admission_buffer`, [sessionId]);
  if (!result.rowCount) throw new ApiError(409, "SESSION_CLOSED", "선택 접수가 종료되었거나 회차가 시작되지 않았습니다.");
}
