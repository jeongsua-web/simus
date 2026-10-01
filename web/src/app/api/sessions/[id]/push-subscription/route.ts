import { NextRequest } from "next/server";
import { ApiError, authenticate, body, checkOrigin, handle, hashToken, json, transaction, uuid } from "@/lib/api";
export const runtime = "nodejs";

export async function GET(request: NextRequest, context: {params:Promise<{id:string}>}) {
  return handle(async () => {
    const sid=uuid((await context.params).id,"session_id");
    const count=await transaction(async db=>{
      const pid=await authenticate(db,request);
      if(!pid) throw new ApiError(401,"UNAUTHORIZED","참여 인증이 필요합니다.");
      const result=await db.query(`SELECT count(*)::int AS count FROM simus.push_subscriptions
        WHERE session_id=$1 AND participant_id=$2 AND revoked_at IS NULL`,[sid,pid]);
      return result.rows[0].count as number;
    });
    return json({active_count:count});
  });
}

export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}) {
  return handle(async()=>{
    checkOrigin(request);
    const sid=uuid((await context.params).id,"session_id");
    const input=await body(request);
    const endpoint=input.endpoint;
    const keys=input.keys;
    let destination:URL|undefined;
    try { if(typeof endpoint==="string") destination=new URL(endpoint); } catch { /* invalid URL */ }
    const host=destination?.hostname ?? "";
    const trustedPushHost=host==="fcm.googleapis.com" || host==="updates.push.services.mozilla.com" ||
      host==="web.push.apple.com" || host.endsWith(".push.apple.com") || host.endsWith(".notify.windows.com");
    if(typeof endpoint!=="string" || endpoint.length>2048 || !endpoint.startsWith("https://") ||
      destination?.protocol!=="https:" || !trustedPushHost || destination.username || destination.password ||
      !keys || typeof keys!=="object" || Array.isArray(keys) ||
      typeof (keys as Record<string,unknown>).p256dh!=="string" || typeof (keys as Record<string,unknown>).auth!=="string" ||
      !/^[A-Za-z0-9_-]{80,120}$/.test((keys as Record<string,string>).p256dh) ||
      !/^[A-Za-z0-9_-]{16,40}$/.test((keys as Record<string,string>).auth))
      throw new ApiError(400,"INVALID_SUBSCRIPTION","푸시 구독 정보가 올바르지 않습니다.");
    await transaction(async db=>{
      const pid=await authenticate(db,request);
      if(!pid) throw new ApiError(401,"UNAUTHORIZED","참여 인증이 필요합니다.");
      const session=await db.query("SELECT status FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE",[sid]);
      if(!session.rowCount || session.rows[0].status!=="RUNNING") throw new ApiError(409,"SESSION_CLOSED","진행 중인 회차에서만 알림을 신청할 수 있습니다.");
      const member=await db.query("SELECT 1 FROM simus.participant_sessions WHERE session_id=$1 AND participant_id=$2",[sid,pid]);
      if(!member.rowCount) throw new ApiError(404,"MEMBERSHIP_NOT_FOUND","먼저 회차에 입장해주세요.");
      await db.query(`INSERT INTO simus.push_subscriptions(session_id,participant_id,endpoint_hash,endpoint,p256dh,auth_secret)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(session_id,participant_id,endpoint_hash)
        DO UPDATE SET endpoint=EXCLUDED.endpoint,p256dh=EXCLUDED.p256dh,auth_secret=EXCLUDED.auth_secret,
          consented_at=clock_timestamp(),revoked_at=NULL`,
        [sid,pid,hashToken(endpoint),(endpoint as string),(keys as Record<string,string>).p256dh,(keys as Record<string,string>).auth]);
    });
    return json({subscribed:true},201);
  });
}

export async function DELETE(request:NextRequest,context:{params:Promise<{id:string}>}) {
  return handle(async()=>{
    checkOrigin(request);
    const sid=uuid((await context.params).id,"session_id");
    await transaction(async db=>{
      const pid=await authenticate(db,request);
      if(!pid) throw new ApiError(401,"UNAUTHORIZED","참여 인증이 필요합니다.");
      await db.query(`UPDATE simus.push_subscriptions SET revoked_at=clock_timestamp()
        WHERE session_id=$1 AND participant_id=$2 AND revoked_at IS NULL`,[sid,pid]);
      await db.query(`UPDATE simus.push_jobs SET status='CANCELLED' WHERE session_id=$1
        AND subscription_id IN (SELECT id FROM simus.push_subscriptions WHERE session_id=$1 AND participant_id=$2)
        AND status IN ('PENDING','FAILED')`,[sid,pid]);
    });
    return json({subscribed:false});
  });
}
