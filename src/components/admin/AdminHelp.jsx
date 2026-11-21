"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp, X } from "lucide-react";
import { adminWorkspaces } from "./adminWorkspaces";
import { getAdminGuide, getAdminTour } from "./adminHelpContent.mjs";

const dashboardPaths = ["/admin", ...Object.values(adminWorkspaces).map(item => item.href)];
const actionClass = "min-h-11 rounded-xl px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export default function AdminHelp({ pathname, session }) {
  const role = session.adminRole || session.role;
  const email = session.email?.trim().toLowerCase();
  const permissions = Array.isArray(session.permissions) ? session.permissions : [];
  const marker = email ? `admin-dashboard-tour:v1:${email}` : "";
  const guide = getAdminGuide(pathname, role, permissions);
  const tour = getAdminTour(dashboardPaths, role, permissions);
  const canTour = tour.length > 0;
  const dialog = useRef(null);
  const heading = useRef(null);
  const helpButton = useRef(null);
  const prompted = useRef("");
  const titleId = useId();
  const [mode, setMode] = useState(null);
  const [index, setIndex] = useState(0);
  const activeStep = tour[Math.min(index, tour.length - 1)];

  useEffect(() => {
    if (pathname !== "/admin" || !marker || !canTour || prompted.current === marker) return;
    let seen = false;
    try { seen = localStorage.getItem(marker) === "seen"; } catch {}
    if (seen) return;

    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      prompted.current = marker;
      setIndex(0);
      setMode("tour");
    });
    return () => { active = false; };
  }, [pathname, marker, canTour]);

  useEffect(() => {
    const element = dialog.current;
    if (mode && element) {
      if (!element.open) element.showModal();
      heading.current?.focus();
    }
  }, [mode, index]);

  function dismiss() {
    if (mode === "tour" && marker) {
      try { localStorage.setItem(marker, "seen"); } catch {}
    }
    setMode(null);
    helpButton.current?.focus();
  }

  function replay() {
    setIndex(0);
    setMode("tour");
  }

  const currentGuide = mode === "tour" ? activeStep : guide;
  if (!marker || (!guide && (pathname !== "/admin" || !canTour))) return null;

  return (
    <>
      <button ref={helpButton} type="button" aria-label="Help" aria-haspopup="dialog"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        onClick={() => setMode("help")}>
        <CircleHelp size={19} aria-hidden="true" />
      </button>
      <dialog ref={dialog} aria-labelledby={titleId} onClose={dismiss}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(35rem,calc(100%-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/55">
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-xs font-bold text-slate-600">
                {mode === "tour" ? `Dashboard tour · ${Math.min(index + 1, tour.length)} of ${tour.length}` : "Admin help"}
              </p>
              <h2 ref={heading} id={titleId} tabIndex={-1} className="mt-1 text-xl font-bold">
                {mode === "tour" ? activeStep?.title : guide ? "How this page works" : "Dashboard tour"}
              </h2>
            </div>
            <button type="button" aria-label="Close help" onClick={() => dialog.current.close()}
              className={`${actionClass} shrink-0 p-2 text-slate-700 hover:bg-slate-100`}>
              <X size={19} aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto px-5 py-4 text-sm leading-6 text-slate-700">
            {currentGuide ? <>
              <p>{currentGuide.intro}</p>
              {mode === "help" || role === "event_staff" || currentGuide.title === "Dashboard" ? <>
                <ol className="mt-3 list-decimal space-y-2 pl-5">
                  {currentGuide.steps.map(({ text }) => <li key={text}>{text}</li>)}
                </ol>
                {mode === "help" && <p className="mt-4 rounded-xl bg-slate-50 p-3"><strong>Tip:</strong> {currentGuide.tip}</p>}
              </> : null}
            </> : <p>See the dashboard tools available for your work.</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
            {mode === "tour" ? <>
              <button type="button" className={`${actionClass} text-slate-700 hover:bg-slate-100`} onClick={() => dialog.current.close()}>Skip tour</button>
              <div className="flex flex-wrap gap-2">
                {index > 0 && <button type="button" className={`${actionClass} border border-slate-200`} onClick={() => setIndex(index - 1)}>Back</button>}
                <button type="button" className={`${actionClass} bg-slate-900 text-white`}
                  onClick={() => {
                    if (index + 1 >= tour.length) dialog.current.close();
                    else setIndex(index + 1);
                  }}>{index + 1 >= tour.length ? "Finish tour" : "Next"}</button>
              </div>
            </> : canTour && <button type="button" className={`${actionClass} bg-slate-900 text-white`} onClick={replay}>Replay tour</button>}
          </div>
        </div>
      </dialog>
    </>
  );
}
