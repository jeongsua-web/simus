import {NextRequest} from 'next/server';
import {ApiError,authenticate,handle,json,transaction,uuid} from '@/lib/api';
import {advanceEvent} from '@/lib/npc-events';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}) {
 return handle(async()=>{
 const sid=uuid((await context.params).id,'session_id');
 return json(await transaction(async db=>{
 const pid=await authenticate(db,request);
 if(!pid) throw new ApiError(401,'UNAUTHORIZED','먼저 익명 참여자를 생성해주세요.');
 const session=await db.query('SELECT id FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE',[sid]);
 if(!session.rowCount) throw new ApiError(404,'SESSION_NOT_FOUND','회차를 찾을 수 없습니다.');
 return advanceEvent(db,sid,pid);
 }));
 });
}
