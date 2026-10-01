import webpush from "web-push";
import { getPool } from "./db";
import { transaction } from "./api";

type Job = {id:string;session_id:string;endpoint:string;p256dh:string;auth_secret:string};
export async function deliverPushJobs() {
  const publicKey=process.env.VAPID_PUBLIC_KEY;
  const privateKey=process.env.VAPID_PRIVATE_KEY;
  const subject=process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return {configured:false,processed:0};
  let processed=0;
  for(let i=0;i<20;i++) {
    const job=await transaction(async db=>{
      const selected=await db.query<Job>(`SELECT j.id,j.session_id,s.endpoint,s.p256dh,s.auth_secret
        FROM simus.push_jobs j JOIN simus.push_subscriptions s ON s.id=j.subscription_id
        WHERE (j.status IN ('PENDING','FAILED') AND j.next_attempt_at<=clock_timestamp()
          OR j.status='SENDING' AND j.claimed_at<clock_timestamp()-interval '2 minutes')
          AND j.attempts<5 AND s.revoked_at IS NULL
        ORDER BY j.next_attempt_at,j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1`);
      if (!selected.rowCount) return null;
      await db.query(`UPDATE simus.push_jobs SET status='SENDING',claimed_at=clock_timestamp(),attempts=attempts+1 WHERE id=$1`,[selected.rows[0].id]);
      return selected.rows[0];
    });
    if(!job) break;
    try {
      await webpush.sendNotification({endpoint:job.endpoint,keys:{p256dh:job.p256dh,auth:job.auth_secret}},
        JSON.stringify({title:"SIM:US 결과가 도착했습니다",url:`/result/${job.session_id}`,tag:job.id}),
        {vapidDetails:{subject,publicKey,privateKey},TTL:86400,timeout:10000,topic:job.id.replaceAll('-','').slice(0,32)});
      await getPool().query(`UPDATE simus.push_jobs SET status='SENT',sent_at=clock_timestamp(),last_error=NULL WHERE id=$1 AND status='SENDING'`,[job.id]);
    } catch(error) {
      const status=typeof error==='object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
      const expired=status===404 || status===410;
      await transaction(async db=>{
        await db.query(`UPDATE simus.push_jobs SET status=CASE WHEN $2 THEN 'CANCELLED' WHEN attempts>=5 THEN 'FAILED' ELSE 'FAILED' END,
          next_attempt_at=clock_timestamp()+make_interval(secs=>LEAST(3600,60*power(2,attempts-1))::int),last_error=$3
          WHERE id=$1`,[job.id,expired,`push service status ${status || 'network error'}`]);
        if(expired) await db.query(`UPDATE simus.push_subscriptions SET revoked_at=clock_timestamp()
          WHERE id=(SELECT subscription_id FROM simus.push_jobs WHERE id=$1)`,[job.id]);
      });
    }
    processed++;
  }
  return {configured:true,processed};
}
