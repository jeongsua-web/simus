"use client";

import { CityStats, type City } from "../../components/CityStats";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "./result.module.css";

type SessionInfo = { id: string; name: string; status: "DRAFT" | "RUNNING" | "CLOSING" | "FINALIZED"; situation_count: number };
type Result = { session_id: string; x_score: string; y_score: string; response_count: string; alignment_code: string; interpretation: string; finalized_at: string };
const names: Record<string, string> = {
  LAWFUL_GOOD:"질서 선", LAWFUL_NEUTRAL:"질서 중립", LAWFUL_EVIL:"질서 악",
  NEUTRAL_GOOD:"중립 선", TRUE_NEUTRAL:"완전 중립", NEUTRAL_EVIL:"중립 악",
  CHAOTIC_GOOD:"혼돈 선", CHAOTIC_NEUTRAL:"혼돈 중립", CHAOTIC_EVIL:"혼돈 악",
};

export default function ResultClient({ sessionId }: { sessionId: string }) {
  const [city,setCity]=useState<City|null>(null);
  const [session,setSession]=useState<SessionInfo|null>(null);
  const [responseCount,setResponseCount]=useState(0);
  const [result,setResult]=useState<Result|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const load=useCallback(async()=>{
    try {
      setError("");
      const response=await fetch(`/api/sessions/${sessionId}/responses`,{cache:"no-store"});
      if(!response.ok){ const body=await response.json(); throw new Error(body.error?.message??"회차 상태를 확인하지 못했습니다."); }
      const own=await response.json() as {session:SessionInfo;responses:unknown[]};
      setSession(own.session); setResponseCount(own.responses.length);
      if(own.session.status==="FINALIZED"){
        const resultResponse=await fetch(`/api/sessions/${sessionId}/result`,{cache:"no-store"});
        if(!resultResponse.ok){ const body=await resultResponse.json(); throw new Error(body.error?.message??"결과를 불러오지 못했습니다."); }
        const data = await resultResponse.json() as {result:Result|null;city_state:City|null};
        setResult(data.result); setCity(data.city_state);
      } else setResult(null);
    } catch(e){ setError(e instanceof Error?e.message:"결과를 불러오지 못했습니다."); }
    finally{ setLoading(false); }
  },[sessionId]);
  useEffect(()=>{ const first=window.setTimeout(()=>void load(),0); const timer=window.setInterval(()=>void load(),5000); return()=>{window.clearTimeout(first);window.clearInterval(timer);}; },[load]);
  if(loading) return <main className={styles.page}><section className={styles.card} role="status">결과 상태를 확인하는 중이에요…</section></main>;
  if(error) return <main className={styles.page}><section className={styles.card}><h1>결과를 불러오지 못했습니다</h1><p role="alert">{error}</p><button onClick={()=>void load()}>다시 시도</button><Link href="/participate">참여 화면으로</Link></section></main>;
  const finalized=session?.status==="FINALIZED";
  return <main className={styles.page}><section className={styles.card}>
    <p className={styles.eyebrow}>SIM:US 개인 결과</p>
    <h1>{session?.name}</h1>
    {!finalized && <div className={styles.pending}><span className={styles.pulse}/><div><strong>{session?.status==="CLOSING"?"결과 준비 중":"회차 진행 중"}</strong><p>개인 점수와 성향은 회차가 종료되고 결과가 확정된 뒤 공개됩니다.</p></div></div>}
    {finalized && result && <div className={styles.result}>
      <p>나의 도시 성향</p><h2>{names[result.alignment_code]??result.alignment_code}</h2>
      <p className={styles.interpretation}>{result.interpretation}</p>
      <dl><div><dt>응답 수</dt><dd>{result.response_count}</dd></div><div><dt>질서 축</dt><dd>{result.x_score}</dd></div><div><dt>도덕 축</dt><dd>{result.y_score}</dd></div></dl>
    </div>}
    {finalized && !result && <div className={styles.pending}><div><strong>확정된 개인 결과가 없습니다</strong><p>이 회차에 반영된 응답이 없거나, 무응답 제외 규칙이 적용되었습니다. 확인된 응답 수: {responseCount}개</p></div></div>}
    {finalized && city && <CityStats city={city} title="이 회차의 최종 도시"/>}
    <div className={styles.actions}>{!finalized&&<button onClick={()=>void load()}>상태 새로고침</button>}<Link href="/participate">참여 화면으로</Link></div>
  </section></main>;
}
