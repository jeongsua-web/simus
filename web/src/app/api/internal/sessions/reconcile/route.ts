import { NextRequest } from "next/server";
import { requireJobToken } from "@/lib/admin-auth";
import { handle, json } from "@/lib/api";
import { reconcileSessions } from "@/lib/session-lifecycle";
import { deliverPushJobs } from "@/lib/push-delivery";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return handle(async () => {
    requireJobToken(request);
    const sessions=await reconcileSessions();
    return json({ sessions, push: await deliverPushJobs() });
  });
}
