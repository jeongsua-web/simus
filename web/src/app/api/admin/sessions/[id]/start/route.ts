import { NextRequest } from "next/server";
import { adminSubject, requireAdmin } from "@/lib/admin-auth";
import { body, checkOrigin, handle, json, transaction, uuid } from "@/lib/api";
import { startSession } from "@/lib/session-lifecycle";
export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    checkOrigin(request);
    const subject = await adminSubject(request);
    const input = await body(request);
    const sessionId = uuid((await context.params).id, "session_id");
    const requestKey = uuid(input.request_key, "request_key");
    const adminId = await transaction(db => requireAdmin(db, subject));
    return json(await startSession(adminId, sessionId, requestKey));
  });
}
