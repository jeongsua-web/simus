export class ApiError extends Error {constructor(status,message){super(message);this.status=status;}}
export async function api(path,body){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
 try{const response=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:controller.signal});let data;try{data=await response.json();}catch{throw new ApiError(response.status,'서버 응답을 읽을 수 없어요.');}if(!response.ok)throw new ApiError(response.status,data.error||'요청을 처리하지 못했어요.');return data;}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(0,'연결을 확인해 주세요. 처리 여부가 불확실하면 같은 요청으로 다시 확인합니다.');}finally{clearTimeout(timer);}
}
export const pendingKey='simus.mobile.pending.v1';
export function readPending(storage=localStorage){try{const p=JSON.parse(storage.getItem(pendingKey));return p&&['round','situation','choice','request'].every(k=>typeof p[k]==='string')?p:null;}catch{return null;}}
export function makeChoice(round,situation,choice,request=crypto.randomUUID()){return {round,situation,choice,request};}
export function isFinal(round){return round?.status==='FINALIZED';}
export function canChoose(round,online,busy){return Boolean(round?.accepting&&round?.status==='RUNNING'&&online&&!busy);}
export function visibleResult(round,me){return isFinal(round)?me?.result:null;}
