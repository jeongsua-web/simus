"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CityStats, type City } from "../components/CityStats";
import Link from "next/link";
import { resultRequest, ResultRequestError } from "../result/request";
import styles from "../result/[id]/result.module.css";

type Shared = { session:{id:string;name:string}; result_kind:string; response_count:number;
  result:{alignment_code:string;interpretation:string;x_score:string;y_score:string;response_count:string}|null; city_state:City|null };

export default function SharedResultPage() {
  const [data,setData]=useState<Shared|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [pending,setPending]=useState(false);
  const [retryable,setRetryable]=useState(false);
  const generation=useRef(0);
  const load=useCallback(async()=>{
    const current=++generation.current;
    setLoading(true); setError(""); setData(null); setPending(false); setRetryable(false);
    const token=location.hash.slice(1);
    try {
      if(!/^[0-9a-f]{64}$/.test(token)) throw new ResultRequestError("결과 링크가 없거나 형식이 올바르지 않습니다. 전달받은 전체 링크를 다시 열어 주세요.","INVALID_TOKEN");
      const payload=await resultRequest<Shared>("/api/shared-result",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});
      if(current!==generation.current) return;
      if(payload.result_kind==="SCORED" && !payload.result) throw new Error("개인 결과를 확인하지 못했습니다. 다시 시도해 주세요.");
      setData(payload);
    } catch(reason) {
      if(current!==generation.current) return;
      const code=reason instanceof ResultRequestError ? reason.code : undefined;
      setPending(code==="RESULT_NOT_FINALIZED");
      setRetryable(code!=="INVALID_TOKEN" && code!=="LINK_NOT_FOUND");
      setError(code==="LINK_NOT_FOUND" ? "결과 링크가 만료되었거나 재발급으로 무효가 되었습니다. 참여했던 기기에서 새 링크를 발급받아 주세요." : reason instanceof Error?reason.message:"결과를 불러오지 못했습니다.");
    } finally { if(current===generation.current) setLoading(false); }
  },[]);
  useEffect(()=>{
    const timer=window.setTimeout(()=>void load(),0);
    const changed=()=>void load();
    window.addEventListener("hashchange",changed);
    return()=>{ window.clearTimeout(timer); generation.current++; window.removeEventListener("hashchange",changed); };
  },[load]);
  return <main className={styles.page}><meta name="referrer" content="no-referrer"/><section className={styles.card}>
    <p className={styles.eyebrow}>SIM:US 공유 결과</p>
    {error ? <><h1>{pending?"결과 준비 중":"결과를 불러오지 못했습니다"}</h1><p role={pending?"status":"alert"}>{pending?"개인 점수와 성향은 회차가 종료되고 결과가 확정된 뒤 공개됩니다.":error}</p>{retryable && <button disabled={loading} onClick={()=>void load()}>{pending?"결과 다시 확인":"다시 시도"}</button>}</> : !data ? <p role="status">결과를 확인하는 중이에요…</p> : <>
      <h1>{data.session.name}</h1>
      {data.result_kind==="NO_RESPONSE" && <div className={styles.pending}>참여한 선택 없음 · 개인 성향 점수는 표시하지 않습니다.</div>}
      {data.result_kind==="SCORED" && data.result && <div className={styles.result}><p>나의 도시 성향</p><h2>{data.result.alignment_code}</h2><p className={styles.interpretation}>{data.result.interpretation}</p><p>응답 {data.response_count}개 · 질서 축 {data.result.x_score} · 도덕 축 {data.result.y_score}</p></div>}
      {data.result_kind==="NOT_JOINED" && <div className={styles.pending}>이 회차의 참여 기록이 없습니다. 참여했던 기기에서 확인해 주세요.</div>}
      {data.city_state && <CityStats city={data.city_state} title="이 회차의 최종 도시"/>}
    </>}
    <div className={styles.actions}><Link href="/participate">참여 화면으로</Link></div>
  </section></main>;
}
