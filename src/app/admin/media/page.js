"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Layers3, ShieldCheck } from "lucide-react";
import { adminFetch } from "@/services/adminApi";
import MediaUploader from "@/components/admin/MediaUploader";

export default function AdminMediaPage() {
  const [banner, setBanner] = useState("");
  const [reward, setReward] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all(["banner","reward"].map(kind=>
      adminFetch("/api/admin/media/upload?kind="+kind).then(async response=>{
        const data=await response.json();
        if(!response.ok) throw new Error(data.message||"Unable to load media.");
        return data.url||"";
      })
    )).then(([bannerUrl,rewardUrl])=>{if(active){setBanner(bannerUrl);setReward(rewardUrl);}})
      .catch(cause=>{if(active)setError(cause.message||"Unable to load media settings.");});
    return()=>{active=false;};
  },[]);
  return (
    <main className="min-h-screen bg-[#f5f6fa] p-4 text-slate-900 md:p-8">
      <div className="mb-8">
        <span className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-rose-700"><Layers3 size={16}/> Brand assets</span>
        <h1 className="text-3xl font-black">Media <span className="text-rose-600">library.</span></h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Manage the student homepage banner and reward artwork. Workshops have their own upload option in the Workshop editor; custom badge artwork can be uploaded in the Badge studio.</p>
      </div>
      {error&&<p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="flex items-center gap-2"><ImagePlus size={20} className="text-rose-700"/><h2 className="text-lg font-extrabold">Homepage banner</h2></div>
          <p className="text-xs leading-5 text-slate-600">Optional background for the existing Skill Quest welcome hero. No visual change occurs until a banner is uploaded.</p>
          <MediaUploader kind="banner" initialUrl={banner} onUploaded={setBanner}/>
        </section>
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="flex items-center gap-2"><ImagePlus size={20} className="text-rose-700"/><h2 className="text-lg font-extrabold">Reward artwork</h2></div>
          <p className="text-xs leading-5 text-slate-600">Optional image displayed alongside students&apos; existing reward celebration.</p>
          <MediaUploader kind="reward" initialUrl={reward} onUploaded={setReward}/>
        </section>
      </div>
      <div className="mt-6 flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-xs leading-6 text-slate-700"><ShieldCheck size={19} className="mt-1 shrink-0 text-indigo-700"/> Uploaded image bytes are verified server-side, stored in configured Firebase Storage, and linked in Cosmos DB. Access is limited by administrator permissions. The storage bucket must be enabled for this to work.</div>
    </main>
  );
}
