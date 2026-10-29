"use client";
import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, Download, RefreshCw, Users, CheckCircle2, TrendingUp, BookOpen, ArrowUpRight } from "lucide-react";
import { adminFetch } from "@/services/adminApi";

const periods = [{value:"weekly",label:"Week"},{value:"monthly",label:"Month"},{value:"yearly",label:"Year"}];
export default function EngagementPage() {
  const [period,setPeriod] = useState("monthly");
  const [date,setDate] = useState(new Date().toISOString().slice(0,10));
  const [report,setReport] = useState(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [exporting,setExporting] = useState(false);
  useEffect(()=> {
    let active = true;
    queueMicrotask(()=>{if(active) setLoading(true);});
    adminFetch(`/api/admin/engagement?period=${period}&date=${date}`)
      .then(async r=>{const data=await r.json();if(!r.ok) throw new Error(data.message || "Unable to load engagement data.");if(active){setReport(data);setError("");}})
      .catch(e=>{if(active){setError(e.message);setReport(null);}})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[period,date]);
  async function exportReport() {
    setExporting(true);
    setError("");
    try {
      const r=await adminFetch(`/api/admin/engagement?period=${period}&date=${date}&format=csv`);
      if(!r.ok){const d=await r.json();throw new Error(d.message || "Export unavailable.");}
      const blob=await r.blob();const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download=`workshop-engagement-${period}-${date}.csv`;
      document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    } catch(e){setError(e.message);} finally {setExporting(false);}
  }
  const rows=report?.workshops||[];
  const max=Math.max(1,...rows.map(r=>r.attended));
  const summary=report?.summary;
  const top=rows.slice(0,12);
  const cards=[
    {label:"Workshops held",value:summary?.workshopsHeld,icon:BookOpen},
    {label:"Verified check-ins",value:summary?.verifiedAttendance,icon:CheckCircle2},
    {label:"Registrations",value:summary?.registrations,icon:Users},
    {label:"Attendance rate",value:summary ? summary.attendanceRate + "%" : null,icon:TrendingUp},
  ];
  return <main className="mx-auto max-w-7xl px-4 py-8 md:px-9 md:py-10">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-rose-600"><BarChart3 size={17}/> PROGRAM INSIGHTS</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Workshop engagement</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">See which completed workshops attracted the most students, with counts from verified attendance scans—not estimated participation.</p>
      </div>
      <button type="button" onClick={exportReport} disabled={!report||exporting} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Download size={17}/>{exporting?"Exporting…":"Export CSV"}</button>
    </header>
    <section className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Report filters">
      <fieldset className="min-w-0"><legend className="mb-2 text-xs font-semibold text-slate-600">Reporting period</legend><div className="inline-flex rounded-xl bg-slate-100 p-1">{periods.map(p=><button type="button" key={p.value} aria-pressed={period===p.value} onClick={()=>setPeriod(p.value)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${period===p.value?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-800"}`}>{p.label}</button>)}</div></fieldset>
      <label className="grid gap-2 text-xs font-semibold text-slate-600"><span className="inline-flex items-center gap-2"><CalendarDays size={15}/> Date within period</span><input className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800" type="date" value={date} max={new Date().toISOString().slice(0,10)} onChange={e=>setDate(e.target.value)}/></label>
      {loading && <span className="inline-flex items-center gap-2 pb-3 text-xs text-slate-500"><RefreshCw size={15} className="animate-spin"/> Updating data…</span>}
      {report && <span className="ml-auto pb-2 text-xs text-slate-500">Period: {report.start} to {new Date(new Date(report.end+"T00:00:00Z").getTime()-86400000).toISOString().slice(0,10)}</span>}
    </section>
    {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Engagement totals">{cards.map(({label,value,icon:Icon})=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">{label}<span className="rounded-xl bg-rose-50 p-2.5 text-rose-600"><Icon size={19}/></span></div><strong className="mt-4 block text-3xl font-bold tracking-tight text-slate-900">{loading?"…":value??"—"}</strong></div>)}</section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Most attended workshops</h2><p className="mt-1 text-xs text-slate-500">Verified student check-ins · ranked highest to lowest</p></div><span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{rows.length} completed workshops</span></div>
      {loading ? <p className="py-16 text-center text-sm text-slate-500">Loading verified attendance…</p> :
       !rows.length ? <div className="flex flex-col items-center gap-3 py-16 text-center text-slate-500"><BarChart3 size={40}/><h3 className="font-semibold text-slate-900">No completed workshops in this period</h3><p className="max-w-md text-sm">Workshops must have a recorded date in the selected period. Only verified attendance scans count.</p></div> :
       <div className="space-y-5" role="img" aria-label="Horizontal bar chart comparing verified student attendance per workshop">{top.map((w,i)=><div key={w.workshopId} className="grid gap-2 sm:grid-cols-[minmax(0,230px)_minmax(0,1fr)_64px] sm:items-center">
         <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800" title={w.title}>{i+1}. {w.title}</p><p className="mt-1 text-xs text-slate-500">{w.date} · {w.programArea}</p></div>
         <div className="h-8 overflow-hidden rounded-lg bg-slate-100"><div className="flex h-full items-center justify-end rounded-lg bg-gradient-to-r from-[#ee7762] to-[#ce493b] pr-2 text-xs font-bold text-white transition-all" style={{width:`${w.attended?Math.max(4,100*w.attended/max):0}%`}}>{w.attended>0?w.attended:""}</div></div>
         <span className="text-right text-sm font-bold text-slate-800">{w.attended} <small className="font-normal text-slate-500">attended</small></span>
       </div>)}</div>}
       {rows.length>12 && <p className="mt-5 text-xs text-slate-500">Chart shows the top 12 workshops; the full list is below.</p>}
    </section>
    <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 md:p-6"><h2 className="text-lg font-bold text-slate-900">Workshop attendance details</h2><p className="mt-1 text-xs text-slate-500">One count per unique student and workshop. Unverified registrations are not counted as attendance.</p></div>
      <div className="overflow-x-auto"><table className="min-w-[720px] w-full text-left text-sm"><thead><tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{["Workshop","Date","Registered","Attended","Not verified","Attendance rate"].map(x=><th className="px-5 py-4" key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(w=><tr key={w.workshopId} className="border-t border-slate-100"><td className="px-5 py-4"><strong className="block text-slate-900">{w.title}</strong><span className="text-xs text-slate-500">{w.programArea}</span></td><td className="px-5 py-4">{w.date}</td><td className="px-5 py-4">{w.registered}</td><td className="px-5 py-4 font-bold text-emerald-700">{w.attended}</td><td className="px-5 py-4">{w.absent}</td><td className="px-5 py-4">{w.attendanceRate}%</td></tr>)}</tbody></table></div>
      {!rows.length && <p className="px-6 py-8 text-center text-sm text-slate-500">No workshop attendance results to display.</p>}
    </section>
    <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500"><ArrowUpRight size={15} className="shrink-0"/> Counts reflect completed workshop registrations with verified attendance QR scans. The period uses the recorded workshop end date (or start date if no end date is set). Data without workshop dates is excluded. This is attendance, not a measure of student satisfaction.</p>
  </main>;
}
