"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImagePlus } from "lucide-react";
import { adminFetch } from "@/services/adminApi";
import MediaUploader from "@/components/admin/MediaUploader";

export default function RewardArtworkPage() {
  const [reward, setReward] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    adminFetch("/api/admin/media/upload?kind=reward")
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load reward artwork.");
        if (active) setReward(data.url || "");
      })
      .catch(cause=>{if(active)setError(cause.message||"Unable to load media settings.");});
    return()=>{active=false;};
  },[]);
  return (
    <main className="min-h-screen bg-[#f5f6fa] p-4 text-slate-900 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black">Reward artwork</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Update the artwork students see when they celebrate a reward.</p>
      </div>
      {error&&<p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
      <section className="max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-2"><ImagePlus size={20} className="text-rose-700"/><h2 className="text-lg font-extrabold">Reward image</h2></div>
        <MediaUploader kind="reward" initialUrl={reward} onUploaded={setReward}/>
      </section>
      <Link href="/admin/media" className="mt-5 inline-block text-sm font-semibold text-rose-800 underline">Back to Homepage banner</Link>
    </main>
  );
}
