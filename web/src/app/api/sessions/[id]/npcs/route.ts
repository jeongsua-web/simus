import { NextRequest } from "next/server";
import { handle, json, transaction, uuid } from "@/lib/api";
import { readNpcs } from "@/lib/participant-npcs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const sid = uuid((await context.params).id, "session_id");
    return json(await transaction(db => readNpcs(db, sid)));
  });
}
