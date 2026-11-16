import { NextRequest } from "next/server";
import { requireJobToken } from "@/lib/auth/admin-auth";
import { handle, json } from "@/lib/api";
import { reconcileSessions } from "@/lib/sessions/session-lifecycle";
import { reconcileNpcEvents } from "@/lib/npc/npc-events";
import { deliverPushJobs } from "@/lib/notifications/push-delivery";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return handle(async () => {
    requireJobToken(request);
    const sessions = await reconcileSessions();
    return json({ sessions, events: await reconcileNpcEvents(), push: await deliverPushJobs() });
  });
}
