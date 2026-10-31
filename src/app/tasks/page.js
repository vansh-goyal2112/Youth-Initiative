"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { studentFetch } from "@/services/studentApi";
export default function StudentTasksPage() {
  const [data,setData]=useState(null);
  const [selected,setSelected]=useState(null);
  const [answers,setAnswers]=useState({});
  const [comment,setComment]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  async function load() {
    try {
      const response=await studentFetch("/api/feedback",{cache:"no-store"});
      const next=await response.json();
      if(!response.ok) throw new Error(next.message||"Tasks unavailable");
      setData(next);
    } catch(e) {setError(e.message);}
  }
  useEffect(()=>{queueMicrotask(()=>{void load();});},[]);
  async function claim(task) {
    setBusy(true);setError("");setMessage("");
    try {
      const response=await studentFetch("/api/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({registrationId:task.id,answers:task.feedback.answers,comment:task.feedback.comment||""})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.message||"Reward unavailable");
      setMessage(result.message);await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function submit(event) {
    event.preventDefault(); if(!selected)return;
    setBusy(true);setMessage("");setError("");
    try {
      const response=await studentFetch("/api/feedback",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({registrationId:selected.id,answers,comment})
      });
      const result=await response.json();
      if(!response.ok) throw new Error(result.message||"Could not save");
      setSelected(null);setAnswers({});setComment("");setMessage(result.message);
      await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <main className="mx-auto max-w-4xl px-5 py-10">
    <Link href="/profile" className="text-indigo-700 underline">← Back to Profile</Link>
    <h1 className="mt-6 text-3xl font-black text-slate-900">My Tasks ✨</h1>
    <p className="mt-2 text-slate-600">Help make the next workshop even better! Five quick answers earn you 20 XP.</p>
    {message&&<p role="status" className="my-4 rounded-lg bg-green-50 p-4 text-green-900">{message}</p>}
    {error&&<p role="alert" className="my-4 rounded-lg bg-red-50 p-4 text-red-900">{error}</p>}
    {!data&&!error&&<p className="mt-8">Loading your workshop tasks…</p>}
    {data&&<section className="mt-7 space-y-4">
      <h2 className="text-xl font-bold">Pending ({data.pendingCount})</h2>
      {data.tasks.filter(t=>!t.feedback||t.rewardStatus!=="completed").length===0&&<p>You&apos;re all caught up. Nice work! 🎉</p>}
      {data.tasks.filter(t=>!t.feedback||t.rewardStatus!=="completed").map(task=><div key={task.id} className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
        <h3 className="font-semibold">{task.title||"Completed Workshop"}</h3>
        <p className="text-sm text-slate-600">Workshop feedback · +20 XP</p>
        <button type="button" onClick={()=>{if(task.feedback){void claim(task);return;}setSelected(task);setAnswers({});setComment("");setError("");}}
          className="mt-3 rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white">{task.feedback?"Check 20 XP reward":"Share Feedback"}</button>
      </div>)}
      <h2 className="pt-4 text-xl font-bold">Completed ({data.tasks.filter(t=>t.feedback&&t.rewardStatus==="completed").length})</h2>
      {data.tasks.filter(t=>t.feedback&&t.rewardStatus==="completed").map(task=><p key={task.id} className="rounded-lg bg-green-50 p-3 text-green-900">✓ {task.title||"Workshop"} — feedback submitted</p>)}
    </section>}
    {selected&&data&&<div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 p-4">
      <form onSubmit={submit} className="mx-auto my-4 max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-2xl font-bold">How was {selected.title||"your workshop"}?</h2>
        <p className="mt-1 text-slate-600">Five quick questions. No long writing needed.</p>
        {data.questions.map((question,index)=><fieldset key={question.id} className="my-5 border-b pb-4">
          <legend className="font-semibold">{index+1}. {question.label}</legend>
          <div className="mt-3 grid gap-2">{question.options.map(option=><label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
            <input type="radio" name={question.id} value={option} required checked={answers[question.id]===option}
              onChange={()=>setAnswers(previous=>({...previous,[question.id]:option}))}/>{option}
          </label>)}</div>
        </fieldset>)}
        <label className="mt-4 block font-semibold" htmlFor="optional-feedback">Anything else you want SAIT to know? (optional)</label>
        <textarea id="optional-feedback" maxLength={500} rows={3} value={comment} onChange={e=>setComment(e.target.value)}
          className="mt-2 w-full rounded-lg border p-3" placeholder="One short suggestion is enough!"/>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white disabled:opacity-50">
            {busy?"Saving…":"Submit & Earn 20 XP"}</button>
          <button type="button" disabled={busy} onClick={()=>setSelected(null)} className="rounded-lg border px-5 py-3">Not now</button>
        </div>
      </form>
    </div>}
  </main>;
}
