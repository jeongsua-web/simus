"use client";
import { useEffect, useState } from "react";
import styles from "./participate.module.css";

function decodeKey(value:string) {
  const raw=atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4));
  return Uint8Array.from(raw,char=>char.charCodeAt(0));
}
export default function PushOptIn({sessionId}:{sessionId:string}) {
  const [key,setKey]=useState<string|null>(null);
  const [active,setActive]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{
    void Promise.all([fetch('/api/push/config'),fetch(`/api/sessions/${sessionId}/push-subscription`)]).then(async ([config,status])=>{
      if(config.ok) setKey((await config.json()).public_key);
      if(status.ok) setActive((await status.json()).active_count>0);
    }).catch(()=>setMessage("알림 상태를 확인하지 못했습니다."));
  },[sessionId]);
  async function subscribe() {
    setBusy(true);setMessage("");
    try {
      if(!key || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
        throw new Error("이 브라우저에서는 웹 푸시를 사용할 수 없습니다.");
      const registration=await navigator.serviceWorker.register('/push-sw.js');
      const permission=await Notification.requestPermission();
      if(permission!=="granted") throw new Error("알림 권한이 허용되지 않았습니다.");
      const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(key)});
      const response=await fetch(`/api/sessions/${sessionId}/push-subscription`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(subscription)});
      if(!response.ok) throw new Error((await response.json()).error?.message??"알림을 신청하지 못했습니다.");
      setActive(true);setMessage("이 기기에서 회차 결과 알림을 받도록 신청했습니다.");
    } catch(error) {setMessage(error instanceof Error?error.message:"알림을 신청하지 못했습니다.");}
    finally{setBusy(false);}
  }
  async function revoke() {
    setBusy(true);
    try {
      const response=await fetch(`/api/sessions/${sessionId}/push-subscription`,{method:'DELETE'});
      if(!response.ok) throw new Error("알림 동의를 철회하지 못했습니다.");
      setActive(false);setMessage("이 회차의 알림 동의를 철회했습니다.");
    } catch(error){setMessage(error instanceof Error?error.message:"알림 동의를 철회하지 못했습니다.");}
    finally{setBusy(false);}
  }
  if(!key) return null;
  return <section className={styles.card}><h2>종료 후 결과 알림</h2><p>알림은 선택 사항입니다. iPhone은 홈 화면에 추가한 뒤 그 앱에서 신청할 수 있습니다.</p>
    <button className={styles.button} disabled={busy} onClick={()=>void (active?revoke():subscribe())}>{active?"알림 동의 철회":"이 기기에서 알림 받기"}</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
