"use client";

import { useEffect, useState } from "react";
import styles from "./CityStats.module.css";

export type City = { session_id?: string; version: string; happiness: number; safety: number; cleanliness: number; overall_pollution: number | null };
export function CityStats({ city, title = "함께 만든 도시" }: { city: City; title?: string }) {
  return <section className={styles.card} aria-label={title}><h2>{title}</h2><dl className={styles.stats}>
    {([["행복도", city.happiness], ["치안", city.safety], ["청결도", city.cleanliness], ["오염도", city.overall_pollution]] as const).map(([label, value]) =>
      <div key={label}><dt>{label}</dt><dd>{value === null ? "집계 없음" : value.toFixed(1)}{label === "오염도" && value !== null ? "%" : ""}</dd></div>)}
  </dl></section>;
}

export function LiveCityStats({ sessionId }: { sessionId: string }) {
  const [city, setCity] = useState<City | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let active = true, busy = false;
    const controller = new AbortController();
    async function poll() {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const response = await fetch("/api/city-state", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("City unavailable");
        const data = await response.json();
        if (active) { setCity(data.city_state?.session_id === sessionId ? data.city_state : null); setOffline(false); }
      } catch { if (active) setOffline(true); }
      finally { busy = false; }
    }
    void poll();
    const timer = window.setInterval(poll, 1000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [sessionId]);
  return <>{city?.session_id === sessionId && <CityStats city={city} />}{offline && <p role="status">도시 연결을 확인하고 있습니다. 마지막으로 확인한 수치입니다.</p>}</>;
}
