"use client";

import { useEffect, useState } from "react";
import styles from "./participate.module.css";

type Department = { id: string; faculty: string; name: string };
type Membership = { department_id: string; locked: boolean; departments: Department[] };

export default function DepartmentSelector({ sessionId, disabled, answered, onSaving }: {
  sessionId: string; disabled: boolean; answered: boolean; onSaving: (value: boolean) => void;
}) {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (saving) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/department`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message ?? "학과 정보를 불러오지 못했습니다.");
        if (!controller.signal.aborted) { setMembership(data); }
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "학과 정보를 불러오지 못했습니다.");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [sessionId, answered, refresh, saving]);

  async function save(departmentId: string) {
    setSaving(true); onSaving(true); setMessage("저장 중…");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/department`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department_id: departmentId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "학과를 저장하지 못했습니다.");
      setMembership(previous => previous && { ...previous, department_id: data.department_id });
      setMessage("학과가 저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장 결과를 확인하지 못했습니다. 다시 확인해주세요.");
    } finally { setSaving(false); onSaving(false); }
  }
  const locked = answered || membership?.locked;
  const faculties = [...new Set(membership?.departments.map(item => item.faculty))];
  return <section className={styles.card} aria-labelledby="department-title">
    <h2 id="department-title">이번 회차의 소속 학과</h2>
    <p className={styles.body}>{locked ? "첫 선택 제출 후 또는 접수 마감 이후에는 학과를 수정할 수 없습니다." : "첫 선택 제출 전까지 수정할 수 있어요. 소속을 밝히지 않아도 참여할 수 있습니다."}</p>
    <label className={styles.departmentLabel} htmlFor="department">소속 학과</label>
    <select id="department" className={styles.departmentSelect} value={membership?.department_id ?? "none"}
      disabled={!membership || disabled || saving || Boolean(locked)} onChange={event => void save(event.target.value)}>
      {!membership && <option value="none">학과 정보 확인 중</option>}
      {faculties.map(faculty => <optgroup key={faculty} label={faculty}>
        {membership!.departments.filter(item => item.faculty === faculty).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </optgroup>)}
    </select>
    <p className={styles.message} role="status">{message}</p>
    {!membership && <button className={styles.secondaryButton} onClick={() => setRefresh(value => value + 1)}>학과 다시 확인</button>}
  </section>;
}
