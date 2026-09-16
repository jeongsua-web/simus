"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import styles from "./admin.module.css";

type Reason={code:string;message:string};
type Session={id:string;name:string;status:"DRAFT"|"RUNNING"|"CLOSING"|"FINALIZED";starts_at:string|null;scheduled_end_at:string;auto_cutoff_at:string;end_requested_at:string|null;finalized_at:string|null;end_mode:"AUTO"|"MANUAL"|null;participant_count:number;response_count:number;can_start:boolean;readiness:Reason[]};
const statusLabel={DRAFT:"시작 전",RUNNING:"진행 중",CLOSING:"종료 처리 중",FINALIZED:"최종 확정"};

export default function AdminPage(){
  const [token,setToken]=useState(""); const [draftToken,setDraftToken]=useState("");
  const [sessions,setSessions]=useState<Session[]>([]); const [loading,setLoading]=useState(false);
  const [error,setError]=useState(""); const [busy,setBusy]=useState<string|null>(null); const [confirmEnd,setConfirmEnd]=useState<string|null>(null);
  const load=useCallback(async(value=token)=>{ if(!value)return; setLoading(true);setError("");try{const response=await fetch("/api/admin/sessions",{headers:{Authorization:`Bearer ${value}`},cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error?.message??"관리자 회차를 불러오지 못했습니다.");setSessions(body.sessions);}catch(e){setError(e instanceof Error?e.message:"관리자 회차를 불러오지 못했습니다.");}finally{setLoading(false);}},[token]);
  useEffect(()=>{const timer=window.setTimeout(()=>{const saved=sessionStorage.getItem("simus_admin_token")??"";if(saved){setToken(saved);setDraftToken(saved);void load(saved);}},0);return()=>window.clearTimeout(timer);},[load]);
  useEffect(()=>{if(!token)return;const timer=window.setInterval(()=>{if(!busy)void load(token);},sessions.some(s=>s.status==="CLOSING")?3000:10000);return()=>clearInterval(timer);},[token,busy,sessions,load]);
  function connect(event:FormEvent){event.preventDefault();const value=draftToken.trim();if(!value)return;sessionStorage.setItem("simus_admin_token",value);setToken(value);void load(value);}
  async function action(session:Session,kind:"start"|"end"){if(!token||busy)return;setBusy(session.id);setError("");try{const response=await fetch(`/api/admin/sessions/${session.id}/${kind}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({request_key:crypto.randomUUID()})});const body=await response.json();if(!response.ok)throw new Error(body.error?.message??"작업을 완료하지 못했습니다.");setConfirmEnd(null);await load(token);}catch(e){setError(e instanceof Error?e.message:"작업을 완료하지 못했습니다.");}finally{setBusy(null);}}
  function disconnect(){sessionStorage.removeItem("simus_admin_token");setToken("");setDraftToken("");setSessions([]);setError("");}
  if(!token)return <main className={styles.page}><section className={styles.login}><p className={styles.eyebrow}>SIM:US OPERATIONS</p><h1>관리자 인증</h1><p>발급받은 관리자 Bearer JWT를 입력하세요. 토큰은 현재 브라우저 탭에만 보관되며 서버가 서명, 만료, 발급자와 활성 관리자 권한을 검증합니다.</p><form onSubmit={connect}><label htmlFor="token">관리자 토큰</label><textarea id="token" rows={5} value={draftToken} onChange={e=>setDraftToken(e.target.value)} autoComplete="off" spellCheck={false}/><button>운영 화면 열기</button></form></section></main>;
  return <main className={styles.page}><header className={styles.header}><div><p className={styles.eyebrow}>SIM:US OPERATIONS</p><h1>회차 운영</h1></div><div className={styles.headerActions}><button onClick={()=>void load()} disabled={loading}>{loading?"불러오는 중…":"새로고침"}</button><button className={styles.quiet} onClick={disconnect}>인증 해제</button></div></header>
    {error&&<div className={styles.error} role="alert"><span>{error}</span><button onClick={()=>void load()}>다시 시도</button></div>}
    <section className={styles.summary} aria-label="회차 상태 요약">{(["RUNNING","CLOSING","DRAFT","FINALIZED"] as const).map(status=><div key={status}><strong>{sessions.filter(s=>s.status===status).length}</strong><span>{statusLabel[status]}</span></div>)}</section>
    <section className={styles.list}>{sessions.map(session=><article key={session.id} className={styles.card}>
      <div className={styles.cardTop}><div><span className={styles.badge} data-status={session.status}>{statusLabel[session.status]}</span><h2>{session.name}</h2><code>{session.id}</code></div><div className={styles.counts}><span>참여자 <strong>{session.participant_count}</strong></span><span>응답 <strong>{session.response_count}</strong></span></div></div>
      <dl className={styles.meta}><div><dt>종료 예정</dt><dd>{new Date(session.scheduled_end_at).toLocaleString("ko-KR")}</dd></div>{session.finalized_at&&<div><dt>최종 확정</dt><dd>{new Date(session.finalized_at).toLocaleString("ko-KR")}</dd></div>}</dl>
      {session.status==="DRAFT"&&<div className={session.can_start?styles.ready:styles.reasons}><strong>{session.can_start?"시작 준비 완료":"시작 전 확인 필요"}</strong>{!session.can_start&&<ul>{session.readiness.map(reason=><li key={reason.code}>{reason.message}</li>)}</ul>}</div>}
      {session.status==="CLOSING"&&<div className={styles.processing}><span/><div><strong>종료 결과를 확정하는 중입니다</strong><p>중복 요청은 막혀 있으며 화면이 자동으로 상태를 확인합니다.</p></div></div>}
      {confirmEnd===session.id&&<div className={styles.confirm} role="alert"><strong>“{session.name}” 회차를 수동 종료할까요?</strong><p>새 응답 접수가 즉시 차단되고, 저장된 응답으로 최종 결과 확정을 시작합니다. 이 작업은 되돌릴 수 없습니다.</p><div><button className={styles.danger} disabled={busy!==null} onClick={()=>void action(session,"end")}>{busy===session.id?"종료 처리 중…":"대상 회차 종료"}</button><button className={styles.quiet} onClick={()=>setConfirmEnd(null)}>취소</button></div></div>}
      <div className={styles.actions}>{session.status==="DRAFT"&&<button disabled={!session.can_start||busy!==null} onClick={()=>void action(session,"start")}>{busy===session.id?"시작 중…":"회차 시작"}</button>}{session.status==="RUNNING"&&<button className={styles.dangerOutline} disabled={busy!==null} onClick={()=>setConfirmEnd(session.id)}>수동 종료</button>}</div>
    </article>)}</section>
    {!loading&&!sessions.length&&<div className={styles.empty}>표시할 회차가 없습니다.</div>}
  </main>;
}
