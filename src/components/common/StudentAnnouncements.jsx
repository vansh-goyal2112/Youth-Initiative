"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {studentFetch} from "@/services/studentApi";
import { getWorkshopSchedule, formatWorkshopDate } from "@/utils/workshopDate.mjs";
export default function StudentAnnouncements({userId}) {
  const [upcoming,setUpcoming]=useState(null);
  const [hidden,setHidden]=useState(false);
  useEffect(()=>{
    if(!userId)return;
    let mounted=true;
    const dismissKey="youth-announcement-dismissed:"+userId;
    try{if(sessionStorage.getItem(dismissKey))queueMicrotask(()=>setHidden(true));}catch{}
    Promise.allSettled([
      studentFetch("/api/workshops",{cache:"no-store"}),
      studentFetch("/api/registrations",{cache:"no-store"})
    ]).then(async results=>{
      if(!mounted)return;
      const parsed=await Promise.all(results.map(async r=>r.status==="fulfilled"&&r.value.ok?r.value.json():null));
      if(!mounted)return;
      const [catalogue,registrations]=parsed;
      const registered=new Set((registrations?.registrations||[]).filter(r=>r.status!=="cancelled").map(r=>r.workshopId));
      const now=new Date();
      const soon=(catalogue?.workshops||[]).map(w=>({...w, startDate:getWorkshopSchedule(w).startDate})).filter(w=>{
        if(!w.startDate||registered.has(w.id))return false;
        const start=new Date(w.startDate+"T23:59:59");
        return !Number.isNaN(start.getTime())&&start>=now;
      }).sort((a,b)=>a.startDate.localeCompare(b.startDate));
      setUpcoming(soon[0]||null);
    }).catch(()=>{});
    return()=>{mounted=false};
  },[userId]);
  if(hidden||!upcoming)return null;
  return <aside role="status" aria-label="Your latest opportunities" className="relative mx-auto my-3 max-w-6xl rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-pink-50 to-amber-50 p-4 text-slate-900 shadow-sm">
    <button type="button" onClick={()=>{setHidden(true);try{sessionStorage.setItem("youth-announcement-dismissed:"+userId,"1");}catch{}}}
      className="absolute right-3 top-2 text-xl" aria-label="Dismiss announcements">×</button>
    <p className="pr-5 text-sm">🚀 Coming up: <strong>{upcoming.title}</strong> · {formatWorkshopDate(upcoming.startDate)} <Link href={`/workshops/${encodeURIComponent(upcoming.id)}`} className="ml-2 font-bold text-indigo-700 underline">Explore and register →</Link></p>
  </aside>;
}
