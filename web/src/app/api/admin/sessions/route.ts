import { NextRequest } from "next/server";
import { adminSubject, requireAdmin } from "@/lib/admin-auth";
import { body, checkOrigin, handle, json, transaction } from "@/lib/api";
import { inspectSessionReadiness } from "@/lib/admin-session-readiness";

import { createSession } from "@/lib/session-creation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const subject = await adminSubject(request);
    const payload = await transaction(async db => {
      await requireAdmin(db, subject);
      const sessions = await db.query(`SELECT s.id,s.name,s.status,s.starts_at,s.scheduled_end_at,
          s.scheduled_end_at-s.admission_buffer AS auto_cutoff_at,s.end_requested_at,s.finalized_at,s.end_mode,
          (SELECT duration_seconds FROM simus.session_creation_requests WHERE session_id=s.id) AS duration_seconds,
          (SELECT count(*)::int FROM simus.participant_sessions WHERE session_id=s.id) AS participant_count,
          (SELECT count(*)::int FROM simus.choice_records WHERE session_id=s.id) AS response_count
        FROM simus.simulation_sessions s ORDER BY s.created_at DESC,s.id`);
      const rows = [];
      for (const session of sessions.rows) {
        const readiness = session.status === "DRAFT" ? await inspectSessionReadiness(db, session.id) : [];
        rows.push({ ...session, can_start: session.status === "DRAFT" && readiness.length === 0, readiness });
      }
      return rows;
    });
    return json({ sessions: payload });
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    checkOrigin(request);
    const subject = await adminSubject(request);
    const result = await createSession(subject, await body(request));
    return json(result, result.replayed ? 200 : 201);
  });
}
