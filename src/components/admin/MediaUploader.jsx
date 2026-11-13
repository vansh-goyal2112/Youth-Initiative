"use client";

import { useId, useState } from "react";
import { CheckCircle2, ImagePlus, LoaderCircle, ShieldCheck } from "lucide-react";
import { adminFetch } from "@/services/adminApi";

export default function MediaUploader({ kind, recordId, initialUrl = "", onUploaded }) {
  const id = useId();
  const [uploaded, setUploaded] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const preview = uploaded || initialUrl;

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);setError("");setNotice("");
    try {
      if (file.size <= 0 || file.size > 5*1024*1024 || !["image/png","image/jpeg","image/webp"].includes(file.type)) {
        throw new Error("Select a PNG, JPG or WebP image under 5 MB.");
      }
      const form = new FormData();
      form.set("kind", kind);
      if (recordId) form.set("recordId", recordId);
      form.set("file", file);
      const response = await adminFetch("/api/admin/media/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Image upload failed.");
      setUploaded(data.url);
      setNotice("Image uploaded and saved to the database.");
      onUploaded?.(data.url);
    } catch (cause) {
      setError(cause.message || "Upload failed.");
    } finally {
      event.target.value = "";
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label={kind + " artwork uploader"}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid h-24 w-32 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white text-slate-400">
          {preview ? <div role="img" aria-label="Current artwork preview" className="h-full w-full bg-cover bg-center bg-no-repeat" style={{backgroundImage:"url("+JSON.stringify(preview)+")"}}/> : <ImagePlus size={30}/>}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold text-slate-900">Upload or replace image</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">PNG, JPG or WebP. Maximum 5 MB. Recommended: workshops 1600 × 900; badges 512 × 512; banners 1920 × 640.</p>
          <label htmlFor={id} className={"mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-rose-800 " + (busy?"pointer-events-none opacity-50":"")}>
            {busy ? <><LoaderCircle size={16} className="animate-spin"/> Uploading…</> : <><ImagePlus size={17}/> Select image</>}
          </label>
          <input id={id} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={upload}/>
        </div>
      </div>
      {notice&&<p role="status" className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-700"><CheckCircle2 size={15}/>{notice}</p>}
      {error&&<p role="alert" className="mt-3 flex items-center gap-2 text-xs font-bold text-rose-700"><ShieldCheck size={15}/>{error}</p>}
    </section>
  );
}
