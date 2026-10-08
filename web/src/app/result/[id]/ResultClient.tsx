"use client";

import { CityStats, type City } from "../../components/CityStats";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { resultRequest } from "../request";
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
  const [result,setResult]=useState<Result|null>(null);
  const [resultKind,setResultKind]=useState("NOT_JOINED");
  const [shareUrl,setShareUrl]=useState("");
  const [shareMessage,setShareMessage]=useState("");
  const shareLock=useRef(false);
  const loadLock=useRef(false);
  const [issuing,setIssuing]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [copying,setCopying]=useState(false);
  const copyLock=useRef(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const load=useCallback(async()=>{
    if(loadLock.current) return;
    loadLock.current=true; setRefreshing(true);
    try {
      setError("");
      const own=await resultRequest<{session:SessionInfo}>(`/api/sessions/${sessionId}/responses`);
      setSession(own.session);
      if(own.session.status==="FINALIZED"){
        const data=await resultRequest<{result:Result|null;city_state:City|null;result_kind:string}>(`/api/sessions/${sessionId}/result`);
        if(data.result_kind==="SCORED" && !data.result) throw new Error("개인 결과를 확인하지 못했습니다. 다시 시도해 주세요.");
        setResult(data.result); setCity(data.city_state); setResultKind(data.result_kind);
      } else setResult(null);
    } catch(e){ setError(e instanceof Error?e.message:"결과를 불러오지 못했습니다."); }
    finally{ loadLock.current=false; setRefreshing(false); setLoading(false); }
  },[sessionId]);
  async function copyShareLink(url: string) {
    if(copyLock.current) return;
    copyLock.current=true; setCopying(true);
    try { await navigator.clipboard.writeText(url); setShareMessage("결과 링크를 복사했습니다."); }
    catch { setShareMessage("복사하지 못했습니다. 복사 다시 시도를 누르거나 아래 링크를 길게 눌러 직접 복사해 주세요."); }
    finally { copyLock.current=false; setCopying(false); }
  }
  async function createShareLink() {
    if(shareLock.current) return;
    shareLock.current=true; setIssuing(true); setShareMessage("");
    // A lost response may still have rotated the server token. Hide the old URL.
    setShareUrl("");
    try {
      const data=await resultRequest<{token:string}>(`/api/sessions/${sessionId}/result-link`, {method:"POST"});
      if(!/^[0-9a-f]{64}$/.test(data.token)) throw new Error("서버 응답을 확인하지 못했습니다.");
      const url=`${location.origin}/shared-result#${data.token}`;
      setShareUrl(url);
      setShareMessage("새 결과 링크를 만들었습니다. 링크 복사 버튼을 눌러 주세요. 이전 링크는 무효입니다.");
    } catch(e) {
      setShareMessage(`${e instanceof Error ? e.message : "링크 발급에 실패했습니다."} 발급 여부를 확인할 수 없어 이전 링크도 사용할 수 없을 수 있습니다. 링크 발급을 다시 시도해 주세요.`);
    } finally { shareLock.current=false; setIssuing(false); }
  }
  useEffect(()=>{ const first=window.setTimeout(()=>void load(),0); return()=>window.clearTimeout(first); },[load]);
  useEffect(()=>{
    if(loading || refreshing || error || !session || session.status==="FINALIZED") return;
    const timer=window.setTimeout(()=>void load(),5000);
    return()=>window.clearTimeout(timer);
  },[loading,refreshing,error,session,load]);
  if(loading) return <main className={styles.page}><section className={styles.card} role="status">결과 상태를 확인하는 중이에요…</section></main>;
  if(error) return <main className={styles.page}><section className={styles.card}><h1>결과를 불러오지 못했습니다</h1><p role="alert">{error}</p><button disabled={refreshing} onClick={()=>void load()}>{refreshing?"확인 중…":"다시 시도"}</button><Link href="/participate">참여 화면으로</Link></section></main>;
  const finalized=session?.status==="FINALIZED";
  return <main className={styles.page}><section className={styles.card}>
    <p className={styles.eyebrow}>SIM:US 개인 결과</p>
    <h1>{session?.name}</h1>
    {!finalized && <div className={styles.pending}><span className={styles.pulse}/><div><strong>{session?.status==="CLOSING"?"결과 준비 중":session?.status==="DRAFT"?"회차 시작 전":"회차 진행 중"}</strong><p>개인 점수와 성향은 회차가 종료되고 결과가 확정된 뒤 공개됩니다.</p></div></div>}
    {finalized && resultKind==="SCORED" && result && <div className={styles.result}>
      <p>나의 도시 성향</p><h2>{names[result.alignment_code]??result.alignment_code}</h2>
      <p className={styles.interpretation}>{result.interpretation}</p>
      <dl><div><dt>응답 수</dt><dd>{result.response_count}</dd></div><div><dt>질서 축</dt><dd>{result.x_score}</dd></div><div><dt>도덕 축</dt><dd>{result.y_score}</dd></div></dl>
    </div>}
    {finalized && resultKind==="NO_RESPONSE" && <div className={styles.pending}><div><strong>참여한 선택 없음</strong><p>이 회차에 입장했지만 제출한 선택은 없습니다. 개인 성향 점수는 표시하지 않습니다.</p></div></div>}
    {finalized && resultKind==="NOT_JOINED" && <div className={styles.pending}><div><strong>이 회차의 참여 기록이 없습니다</strong><p>이 브라우저의 참여 기록이 없습니다. 참여했던 기기·브라우저에서 확인하거나 발급받은 결과 링크를 열어 주세요.</p></div></div>}
    {finalized && city && <CityStats city={city} title="이 회차의 최종 도시"/>}
    {finalized && (resultKind==="SCORED" || resultKind==="NO_RESPONSE") && <div className={styles.share} aria-busy={issuing}>
      <button disabled={issuing || copying} onClick={()=>void createShareLink()}>{issuing?"링크 발급 중…":shareUrl?"새 링크 재발급":"결과 링크 발급 / 다시 시도"}</button>
      <p>링크를 가진 사람은 이 결과를 볼 수 있습니다. 유효 기간은 발급 후 30일입니다. 새 링크를 만들면 이전 링크는 무효가 됩니다.</p>
      {shareUrl && <><label htmlFor="result-share-url">다른 기기용 결과 링크</label><textarea id="result-share-url" readOnly rows={3} value={shareUrl} onFocus={event=>event.currentTarget.select()}/><button disabled={copying || issuing} onClick={()=>void copyShareLink(shareUrl)}>{copying?"복사 중…":"링크 복사 / 복사 다시 시도"}</button></>}
      <p role="status" aria-live="polite">{shareMessage}</p>
    </div>}
    <div className={styles.actions}>{!finalized&&<button disabled={refreshing} onClick={()=>void load()}>{refreshing?"확인 중…":"상태 새로고침"}</button>}<Link href={`/statistics/${sessionId}`}>학과별 통계</Link><Link href="/participate">참여 화면으로</Link></div>
  </section></main>;
}
