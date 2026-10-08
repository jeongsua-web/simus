"use client";

import { Black_Han_Sans, IBM_Plex_Mono } from "next/font/google";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ApiError, Department, Profile, Session } from "./types";
import styles from "./ProfileEntry.module.css";

const display = Black_Han_Sans({ weight: "400", subsets: ["latin"], preload: false, variable: "--font-display" });
const mono = IBM_Plex_Mono({ weight: ["500", "600"], subsets: ["latin"], variable: "--font-mono" });

const AXES = [["E", "외향", "I", "내향"], ["S", "감각", "N", "직관"], ["T", "사고", "F", "감정"], ["J", "판단", "P", "인식"]] as const;
const NICKNAME_HINT = "2~10자. 전시장 화면에 보일 수 있으니 실명은 피해 주세요.";
const SAVE_FAILED = "등록이 저장되지 않았어요. 연결을 확인하고 다시 입장하세요. 입력한 내용은 그대로 있어요.";

const facultyLabel = (faculty: string) => faculty === "학부 지정 없음" ? "기타" : faculty.replace(/학부$/, "");
const normalize = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, " ");

function nicknameError(value: string) {
  const length = [...value].length;
  if (length === 0) return "닉네임을 입력하세요.";
  if (length < 2) return "닉네임을 2자 이상 입력하세요.";
  if (!/^[\p{L}\p{N} _.-]+$/u.test(value)) return "닉네임에는 글자, 숫자, 공백, _ . -만 쓸 수 있어요.";
  return "";
}

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
class EntryError extends Error {}

export default function ProfileEntry({ session, departments, onSaved, onEntered, onStale, children }: {
  session: Session; departments: Department[];
  onSaved: () => void; onEntered: (profile: Profile) => void; onStale: () => void; children?: ReactNode;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Department[]>();
    for (const item of departments) {
      const label = facultyLabel(item.faculty);
      map.set(label, [...(map.get(label) ?? []), item]);
    }
    return [...map.entries()];
  }, [departments]);
  const [nick, setNick] = useState("");
  const [touched, setTouched] = useState(false);
  const [faculty, setFaculty] = useState(0);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [mbti, setMbti] = useState<Array<string | null>>([null, null, null, null]);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const [entered, setEntered] = useState<Profile | null>(null);
  const [stamped, setStamped] = useState(false);
  const [showMini, setShowMini] = useState(false);
  const [loadingShown, setLoadingShown] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new IntersectionObserver(([entry]) => setShowMini(!entry.isIntersecting), { threshold: 0.15 });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  const nickname = normalize(nick);
  const error = nicknameError(nickname);
  const department = departments.find(item => item.id === departmentId);
  const mbtiText = mbti.map(value => value ?? "?").join("");
  const ready = !error && Boolean(department) && mbti.every(Boolean);
  const shownError = touched && error;

  async function enter() {
    if (!ready || saving || entered) return;
    setSaving(true); setFailure("");
    try {
      const response = await fetch(`/api/sessions/${session.id}/profile`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, department_id: departmentId, mbti: mbti.join("") }),
      });
      const data = await response.json() as ApiError & { profile?: Profile };
      if (!response.ok || !data.profile) {
        const code = data.error?.code;
        if (code === "PROFILE_LOCKED" || code === "SESSION_CLOSED" || response.status === 401) onStale();
        throw new EntryError(response.status >= 500 || !data.error?.message ? SAVE_FAILED : data.error.message);
      }
      onSaved();
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
      setEntered(data.profile);
      await wait(still ? 0 : 400);
      setStamped(true);
      await wait(still ? 300 : 700);
      setShowMini(false);
      setLoadingShown(true);
      await wait(still ? 600 : 1500);
      onEntered(data.profile);
    } catch (reason) {
      setFailure(reason instanceof EntryError ? reason.message : SAVE_FAILED);
      setSaving(false);
    }
  }

  const shownName = entered?.nickname ?? nickname;
  const shownDepartment = entered?.department_name ?? department?.name;
  return (
    <div className={`${styles.root} ${display.variable} ${mono.variable}`}>
      <div className={`${styles.mini} ${showMini ? styles.miniShow : ""}`} aria-hidden="true">
        <b>{shownName || "닉네임"}</b><span className={styles.sep}>·</span>
        <span className={styles.miniDept}>{shownDepartment ?? "학과 미선택"}</span>
        <span className={styles.mono}>{mbtiText}</span>
      </div>
      <main className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.wordmark}>SIM<span>:</span>US</div>
        </header>
        <section className={styles.intro}>
          <h1>시민증 만들기</h1>
        </section>

        <article ref={cardRef} className={styles.card} aria-label="시민증 미리보기">
          <div className={styles.cardHead}>
            <span>SIM:US 시민증</span>
            <span className={styles.mono}>No. {stamped && entered ? entered.citizen_no : "··-····"}</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.portrait} aria-hidden="true">
              <svg viewBox="0 0 40 72" fill="none" stroke="#A3B0AE" strokeWidth="2">
                <circle cx="20" cy="12" r="8" />
                <path d="M8 34c0-7 5-12 12-12s12 5 12 12v14H8z" />
                <path d="M13 48v20M27 48v20" />
              </svg>
            </div>
            <div className={styles.fields}>
              <div><div className={styles.fieldLabel}>이름</div>
                <div className={`${styles.cardName} ${shownName ? "" : styles.empty}`}>{shownName || "닉네임"}</div></div>
              <div><div className={styles.fieldLabel}>소속</div>
                <div className={`${styles.cardValue} ${shownDepartment ? "" : styles.empty}`}>{shownDepartment ?? "학과 미선택"}</div></div>
              <div><div className={styles.fieldLabel}>MBTI</div>
                <div className={`${styles.cardMbti} ${mbti.every(Boolean) ? "" : styles.empty}`}>{mbtiText}</div></div>
            </div>
            <div className={`${styles.stamp} ${stamped ? styles.stampDone : ready ? styles.stampReady : ""}`}>
              입주<br />{stamped ? "완료" : ready ? "준비" : "대기"}
            </div>
          </div>
        </article>

        <form className={styles.form} noValidate onSubmit={event => { event.preventDefault(); void enter(); }}>
          <div className={styles.fieldset}>
            <div className={styles.question}><label htmlFor="nickname">닉네임</label><small>필수</small></div>
            <div className={`${styles.input} ${shownError ? styles.inputInvalid : ""}`}>
              <input id="nickname" maxLength={10} autoComplete="off" enterKeyHint="next" placeholder="도시에서 불릴 이름"
                aria-describedby="nickname-hint" aria-invalid={Boolean(shownError)} disabled={saving}
                value={nick} onChange={event => setNick(event.target.value)} onBlur={() => setTouched(true)} />
              <span className={styles.count}>{[...nick].length}/10</span>
            </div>
            <p id="nickname-hint" className={`${styles.hint} ${shownError ? styles.hintError : ""}`}>{shownError || NICKNAME_HINT}</p>
          </div>

          <fieldset className={styles.fieldset} aria-labelledby="department-label" disabled={saving}>
            <div className={styles.question}><span id="department-label">학과</span><small>필수</small></div>
            <div className={styles.faculties} role="group" aria-label="학부">
              {groups.map(([label], index) => <button key={label} type="button" className={styles.faculty}
                aria-pressed={index === faculty} onClick={() => setFaculty(index)}>{label}</button>)}
            </div>
            <div className={styles.departments} role="radiogroup" aria-labelledby="department-label">
              {groups[faculty]?.[1].map(item => <button key={item.id} type="button" role="radio" className={styles.department}
                aria-checked={item.id === departmentId} onClick={() => setDepartmentId(item.id)}>{item.name}</button>)}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset} aria-labelledby="mbti-label" disabled={saving}>
            <div className={styles.question}><span id="mbti-label">MBTI</span><small>필수</small></div>
            <div className={styles.axes}>
              {AXES.map(([a, aLabel, b, bLabel], index) => <div key={a} className={styles.axis} role="radiogroup" aria-label={`${aLabel} 또는 ${bLabel}`}>
                {([[a, aLabel], [b, bLabel]] as const).map(([value, label]) => <button key={value} type="button" role="radio"
                  className={styles.pole} aria-checked={mbti[index] === value} aria-label={`${value} ${label}`}
                  onClick={() => setMbti(previous => previous.map((item, i) => i === index ? value : item))}>
                  <b>{value}</b>{label}
                </button>)}
              </div>)}
            </div>
          </fieldset>
        </form>
        {children && <div className={styles.extra}>{children}</div>}
      </main>

      <div className={styles.dock}>
        <div className={styles.dockInner}>
          {failure && <div className={styles.banner} role="alert"><span aria-hidden="true">!</span><span>{failure}</span></div>}
          <button type="button" className={styles.cta} disabled={!ready || saving} onClick={() => void enter()}>
            {saving && !entered ? "등록하는 중…" : <>도시에 입장하기 <span className={styles.arrow} aria-hidden="true">→</span></>}
          </button>
          <p className={styles.note}>입장한 뒤에는 닉네임·학과·MBTI를 바꿀 수 없어요.</p>
        </div>
      </div>

      <div className={`${styles.loading} ${loadingShown ? styles.loadingShow : ""}`} aria-live="polite">
        {entered && <>
          <div className={styles.pass} aria-hidden="true">
            <strong>{entered.nickname}</strong>
            <span>{entered.department_name}</span>
            <span className={styles.mono}>{entered.mbti}</span>
          </div>
          <h2>입주 완료</h2>
          <p>도시를 불러오는 중이에요. 곧 내 캐릭터를 찾아갈게요.</p>
          <div className={styles.bar}><i /></div>
        </>}
      </div>
    </div>
  );
}
