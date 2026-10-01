"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "./statistics.module.css";

type Choice = { id: string; label: string; count: number; ratio: number };
type Situation = { id: string; title: string; respondent_count: number; suppressed: boolean; choices: Choice[] | null };
type Alignment = { respondent_count: number; no_response_count: number; suppressed: boolean; distribution: Record<string, number> | null };
type Department = { id: string; faculty: string; name: string; participant_count: number; response_count: number; situations: Situation[]; alignment: Alignment | null };
type Statistics = { status: string; minimum_public_group: number; departments: Department[] };
const alignmentNames: Record<string, string> = {
  LAWFUL_GOOD: "질서 선", LAWFUL_NEUTRAL: "질서 중립", LAWFUL_EVIL: "질서 악",
  NEUTRAL_GOOD: "중립 선", TRUE_NEUTRAL: "완전 중립", NEUTRAL_EVIL: "중립 악",
  CHAOTIC_GOOD: "혼돈 선", CHAOTIC_NEUTRAL: "혼돈 중립", CHAOTIC_EVIL: "혼돈 악",
};

export default function StatisticsClient({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<Statistics | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/department-statistics`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "통계를 불러오지 못했습니다.");
      setData(body as Statistics);
      setError("");
      setDepartmentId(previous => previous || body.departments.find((item: Department) => item.participant_count > 0)?.id || "none");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "통계를 불러오지 못했습니다."); }
  }, [sessionId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const department = data?.departments.find(item => item.id === departmentId);
  return <main className={styles.page}><div className={styles.container}>
    <header className={styles.header}><p>SIM:US 회차 통계</p><h1>학과별 참여와 선택</h1>
      <span>이 통계는 전시 참여자의 선택을 보여줍니다. 학과 전체의 성향을 뜻하지 않습니다.</span></header>
    {error && <section className={styles.card} role="alert">{error} <button onClick={() => void load()}>다시 시도</button></section>}
    {!data && !error && <section className={styles.card} role="status">통계를 불러오는 중입니다…</section>}
    {data && <><section className={styles.card}>
      <label htmlFor="department">학과·참여 구분</label>
      <select id="department" value={departmentId} onChange={event => setDepartmentId(event.target.value)}>
        {data.departments.map(item => <option key={item.id} value={item.id}>{item.faculty} · {item.name}</option>)}
      </select>
      <p>선택한 집계에 {data.minimum_public_group}명 이상 참여한 경우 상세를 표시합니다.</p>
    </section>
    {department && <><section className={styles.card}>
      <h2>{department.name}</h2><p>{department.faculty}</p>
      <dl className={styles.counts}><div><dt>참여자</dt><dd>{department.participant_count}명</dd></div>
        <div><dt>총 응답</dt><dd>{department.response_count}건</dd></div></dl>
    </section>
    <section className={styles.card}><h2>상황별 선택</h2>
      {department.situations.map(situation => <div className={styles.situation} key={situation.id}>
        <h3>{situation.title}</h3><p>응답자 {situation.respondent_count}명</p>
        {situation.respondent_count === 0 ? <p>응답 없음</p> : situation.suppressed ?
          <p>{data.minimum_public_group}명 미만이어서 상세 선택은 표시하지 않습니다.</p> :
          <ul>{situation.choices?.map(choice => <li key={choice.id}>
            <span>{choice.label}</span><strong>{Math.round(choice.ratio * 100)}% · {choice.count}명</strong>
          </li>)}</ul>}
      </div>)}
    </section>
    <section className={styles.card}><h2>최종 성향 분포</h2>
      {!department.alignment ? <p>회차 결과가 확정된 뒤 공개됩니다.</p> : <>
        <p>유효 응답자 {department.alignment.respondent_count}명 · 미응답자 {department.alignment.no_response_count}명</p>
        {department.alignment.suppressed ? <p>{data.minimum_public_group}명 미만이어서 성향 상세는 표시하지 않습니다.</p> :
          <ul className={styles.distribution}>{Object.entries(alignmentNames).map(([code, name]) =>
            <li key={code}><span>{name}</span><strong>{department.alignment?.distribution?.[code] ?? 0}명</strong></li>)}</ul>}
      </>}
    </section></>}
    </>}
    <nav className={styles.nav}><Link href={`/result/${sessionId}`}>내 결과로 돌아가기</Link><Link href="/participate">참여 화면으로</Link></nav>
  </div></main>;
}
