"use client";
import {useEffect,useState} from "react";
import {adminFetch} from "@/services/adminApi";
export default function FeedbackInsightsPage() {
  const [data,setData]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  async function load(){
    try{setLoading(true);const response=await adminFetch("/api/admin/feedback");const result=await response.json();
      if(!response.ok)throw new Error(result.message||"Feedback unavailable");setData(result);setError("");
    }catch(e){setError(e.message);}finally{setLoading(false);}
  }
  useEffect(()=>{queueMicrotask(()=>{void load();});},[]);
  async function exportCsv(){
    try{const r=await adminFetch("/api/admin/feedback?format=csv");
      if(!r.ok){const d=await r.json();throw new Error(d.message||"Export denied");}
      const url=URL.createObjectURL(await r.blob());const a=document.createElement("a");a.href=url;a.download="youth-workshop-feedback.csv";a.click();URL.revokeObjectURL(url);
    }catch(e){setError(e.message);}
  }
  return <main className="mx-auto max-w-6xl p-6 md:p-10">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div>
      <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Youth Initiative · Student Voice</p>
      <h1 className="mt-2 text-3xl font-extrabold">Workshop Feedback</h1>
      <p className="mt-2 text-slate-600">Aggregated feedback results. Student accounts are not displayed; please avoid including personal information in suggestions.</p>
    </div><div className="flex gap-3"><button onClick={load} className="rounded-lg border p-3">Refresh</button>
      <button onClick={exportCsv} className="rounded-lg bg-indigo-700 p-3 text-white">Export CSV</button></div></header>
    {error&&<p role="alert" className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
    {loading&&<p>Loading feedback…</p>}
    {data&&<><p className="mb-6 rounded-xl bg-indigo-50 p-5 text-xl font-bold">{data.totalResponses} feedback responses</p>
      {!data.workshops.length&&<p>No feedback has been submitted yet.</p>}
      {data.workshops.map(w=><section key={w.id} className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">{w.title} {w.offeringYear&&<span className="text-sm font-normal">· {w.offeringYear}</span>}</h2>
        <p className="mt-1 text-sm text-slate-600">{w.responses} responses · {w.averageRating===null?"No ratings yet":`⭐ ${w.averageRating}/5 average enjoyment`}</p>
        {data.questions.map(q=><div key={q.id} className="mt-4">
          <h3 className="font-semibold">{q.label}</h3>
          <div className="mt-2 flex flex-wrap gap-2">{Object.entries(w.answers[q.id]||{}).map(([answer,count])=>
            <span key={answer} className="rounded-full bg-indigo-50 px-3 py-1 text-sm">{answer}: <strong>{count}</strong></span>)}</div>
        </div>)}
        {w.comments.length>0&&<details className="mt-5 rounded-lg bg-slate-50 p-4"><summary className="cursor-pointer font-semibold">Optional suggestions ({w.comments.length})</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5">{w.comments.map((comment,i)=><li key={i} className="break-words text-sm">{comment}</li>)}</ul></details>}
      </section>)}
    </>}
  </main>;
}
