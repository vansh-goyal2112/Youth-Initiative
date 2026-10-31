"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {studentFetch} from "@/services/studentApi";
export default function StudentAnnouncements({userId}) {
  const [upcoming,setUpcoming]=useState(null);
  const [pending,setPending]=useState(0);
  const [hidden,setHidden]=useState(false);
  useEffect(()=>{
    if(!userId)return;
    let mounted=true;
    const dismissKey="youth-announcement-dismissed:"+userId;
    try{if(sessionStorage.getItem(dismissKey))setHidden(true);}catch{}
    Promise.allSettled([
      studentFetch("/api/workshops",{cache:"no-store"}),
      studentFetch("/api/registrations",{cache:"no-store"}),
      studentFetch("/api/feedback",{cache:"no-store"})
    ]).then(async results=>{
      if(!mounted)return;
      const parsed=await Promise.all(results.map(async r=>r.status==="fulfilled"&&r.value.ok?r.value.json():null));
      if(!mounted)return;
      const [catalogue,registrations,feedback]=parsed;
      const registered=new Set((registrations?.registrations||[]).filter(r=>r.status!=="cancelled").map(r=>r.workshopId));
      const now=new Date();
      const soon=(catalogue?.workshops||[]).filter(w=>{
        if(!w.startDate||registered.has(w.id))return false;
        const start=new Date(w.startDate+"T23:59:59");
        return !Number.isNaN(start.getTime())&&start>=now;
      }).sort((a,b)=>a.startDate.localeCompare(b.startDate));
      setUpcoming(soon[0]||null);
      setPending(feedback?.pendingCount||0);
    }).catch(()=>{});
    return()=>{mounted=false};
  },[userId]);
  if(hidden||(!upcoming&&!pending))return null;
  return <aside role="status" aria-label="Your latest opportunities" className="relative mx-auto my-3 max-w-6xl rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-pink-50 to-amber-50 p-4 text-slate-900 shadow-sm">
    <button type="button" onClick={()=>{setHidden(true);try{sessionStorage.setItem("youth-announcement-dismissed:"+userId,"1");}catch{}}}
      className="absolute right-3 top-2 text-xl" aria-label="Dismiss announcements">×</button>
    {pending>0&&<p className="mb-2 pr-5 text-sm font-semibold">✨ {pending} workshop feedback {pending===1?"task":"tasks"} waiting! <Link href="/tasks" className="font-bold text-indigo-700 underline">Earn 20 XP each →</Link></p>}
    {upcoming&&<p className="pr-5 text-sm">🚀 Coming up: <strong>{upcoming.title}</strong> · {new Date(upcoming.startDate+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})} <Link href={`/workshops/${encodeURIComponent(upcoming.id)}`} className="ml-2 font-bold text-indigo-700 underline">Explore and register →</Link></p>}
  </aside>;
}
