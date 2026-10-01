"use client";

import { useEffect, useState } from "react";
import { CityStats, type City } from "../components/CityStats";
import Link from "next/link";
import styles from "../result/[id]/result.module.css";

type Shared = { session:{id:string;name:string}; result_kind:string; response_count:number;
  result:{alignment_code:string;interpretation:string;x_score:string;y_score:string;response_count:string}|null; city_state:City|null };

export default function SharedResultPage() {
  const [data,setData]=useState<Shared|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    const token=location.hash.slice(1);
    void (token ? fetch("/api/shared-result",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token}),cache:"no-store"}) : Promise.reject(new Error("결과 링크가 없습니다.")))
      .then(async response=>{ const payload=await response.json(); if(!response.ok) throw new Error(payload.error?.message??"결과를 불러오지 못했습니다."); setData(payload); })
      .catch(reason=>setError(reason instanceof Error?reason.message:"결과를 불러오지 못했습니다."));
  },[]);
  return <main className={styles.page}><meta name="referrer" content="no-referrer"/><section className={styles.card}>
    <p className={styles.eyebrow}>SIM:US 공유 결과</p>
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">결과를 확인하는 중이에요…</p> : <>
      <h1>{data.session.name}</h1>
      {data.result_kind==="NO_RESPONSE" && <div className={styles.pending}>참여한 선택 없음 · 개인 성향 점수는 표시하지 않습니다.</div>}
      {data.result_kind==="SCORED" && data.result && <div className={styles.result}><p>나의 도시 성향</p><h2>{data.result.alignment_code}</h2><p className={styles.interpretation}>{data.result.interpretation}</p><p>응답 {data.response_count}개 · 질서 축 {data.result.x_score} · 도덕 축 {data.result.y_score}</p></div>}
      {data.city_state && <CityStats city={data.city_state} title="이 회차의 최종 도시"/>}
    </>}
    <div className={styles.actions}><Link href="/participate">참여 화면으로</Link></div>
  </section></main>;
}
