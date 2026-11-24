"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import styles from "./page.module.css";

const motionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia(motionQuery).matches;
}

function getServerReducedMotion() {
  return true;
}

export default function Home() {
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    getReducedMotion,
    getServerReducedMotion,
  );
  const video = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [paused, setPaused] = useState(false);

  function togglePlayback() {
    if (!video.current) return;
    if (video.current.paused) {
      void video.current.play().catch(() => setVideoFailed(true));
    } else {
      video.current.pause();
    }
  }

  return (
    <main className={styles.page}>
      {!reducedMotion && !videoFailed && (
        <video
          ref={video}
          className={styles.backgroundVideo}
          src="/videos/city-background.mp4"
          poster="/videos/city-background-poster.webp"
          width={1920}
          height={1080}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          onPlaying={() => { setVideoReady(true); setPaused(false); }}
          onPause={() => setPaused(true)}
          onError={() => setVideoFailed(true)}
        />
      )}

      <div className={styles.overlay} aria-hidden="true" />

      <section className={styles.hero} aria-labelledby="home-title">
        <h1 id="home-title">
          당신의 선택이
          <br />
          도시를 바꿉니다.
        </h1>

        <p className={styles.lead}>
          도시에서 벌어지는 상황을 읽고 행동을 선택하세요.
          <br />
          한 사람의 결정이 도시의 변화에 반영됩니다
        </p>

        <Link className={styles.start} href="/participate" prefetch={false}>
          참여 시작하기
        </Link>
      </section>

      {!reducedMotion && !videoFailed && videoReady && (
        <button className={styles.playback} type="button" onClick={togglePlayback}>
          {paused ? "배경 영상 재생하기" : "배경 영상 멈추기"}
        </button>
      )}
    </main>
  );
}
