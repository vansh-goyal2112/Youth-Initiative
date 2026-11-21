"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Keyboard, LoaderCircle, QrCode } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "@/contexts/AuthContext";
import { studentFetch } from "@/services/studentApi";

export default function ScanAttendancePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const scannerReference = useRef(null);
  const verifyingReference = useRef(false);

  const [mode, setMode] = useState("qr");
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    return () => {
      const scanner = scannerReference.current;
      if (scanner?.isScanning) scanner.stop().catch(() => {});
    };
  }, []);

  async function stopCamera() {
    const scanner = scannerReference.current;
    if (scanner?.isScanning) {
      try { await scanner.stop(); } catch { /* camera may already have stopped */ }
    }
    scannerReference.current = null;
    setScanning(false);
  }

  async function changeMode(nextMode) {
    await stopCamera();
    setErrorMessage("");
    setMode(nextMode);
  }

  async function verifyAttendance(payload) {
    if (verifyingReference.current) return;
    verifyingReference.current = true;
    setVerifying(true);
    setErrorMessage("");
    try {
      const response = await studentFetch("/api/attendance/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, { limitedUse: true });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Attendance could not be verified.");

      // Both QR and manual code use the same verified attendance and full-XP flow.
      if (data.rewardPending || !data.reward) {
        router.push("/journey");
        return;
      }
      sessionStorage.setItem("latestReward", JSON.stringify({
        workshop: data.workshop,
        reward: data.reward,
      }));
      router.push("/reward");
    } catch (error) {
      setErrorMessage(error.message || "Attendance could not be verified.");
      setVerifying(false);
      verifyingReference.current = false;
    }
  }

  async function verifyQr(qrText) {
    try {
      const payload = JSON.parse(qrText);
      if (!payload?.attendanceSessionId || !payload?.code) {
        throw new Error("This QR code is not a valid workshop attendance code.");
      }
      await verifyAttendance({
        attendanceSessionId: payload.attendanceSessionId,
        code: payload.code,
      });
    } catch (error) {
      setErrorMessage(error.message || "QR code could not be read.");
      setVerifying(false);
      verifyingReference.current = false;
    }
  }

  async function startScanner() {
    if (scanning || verifying || authLoading || !user) return;
    try {
      setErrorMessage("");
      const scanner = new Html5Qrcode("attendance-reader");
      scannerReference.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async decodedText => {
          if (verifyingReference.current) return;
          await stopCamera();
          await verifyQr(decodedText);
        },
        () => {}
      );
    } catch (error) {
      console.error("Scanner error:", error);
      await stopCamera();
      setErrorMessage("Can't open the camera. Choose Enter code instead or allow camera access.");
    }
  }

  function submitManualCode(event) {
    event.preventDefault();
    if (verifying || authLoading || !user) return;
    if (!/^[0-9]{4}$/.test(manualCode)) {
      setErrorMessage("Enter the four-digit code shown by your instructor.");
      return;
    }
    void verifyAttendance({ manualCode });
  }

  if (!authLoading && !user) {
    return (
      <main className="attendance-login-required">
        <h1>Login Required</h1>
        <p>Log in to mark attendance at your workshop.</p>
        <Link href="/login">Login</Link>
      </main>
    );
  }

  return (
    <main className="scan-attendance-page">
      <section className="scan-attendance-card">
        <div className="scan-heading">
          <QrCode size={38} />
          <span>WORKSHOP ATTENDANCE</span>
          <h1>Scan Attendance</h1>
          <p>{mode === "qr"
            ? "Scan the QR code shown by your workshop instructor."
            : "Enter the four-digit code displayed beneath the instructor's QR code."}</p>
        </div>

        <div id="attendance-reader" className="attendance-camera" hidden={mode !== "qr"} />

        {mode === "code" && (
          <form onSubmit={submitManualCode} className="mt-5 flex flex-col items-center gap-4">
            <label htmlFor="manual-attendance-code" className="text-sm font-semibold text-slate-700">
              Four-digit attendance code
            </label>
            <input
              id="manual-attendance-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="0000"
              required
              value={manualCode}
              onChange={event => setManualCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
              className="w-48 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.25em] text-slate-900"
            />
            <button type="submit" className="attendance-scan-button" disabled={verifying || authLoading || !user || manualCode.length !== 4}>
              {verifying ? <><LoaderCircle size={20} className="button-spinner" /> Checking your attendance...</> :
                <><Keyboard size={20} /> Mark attendance</>}
            </button>
          </form>
        )}

        {errorMessage && <div className="attendance-error" role="alert">{errorMessage}</div>}

        {mode === "qr" && (
          verifying ? (
            <button disabled className="attendance-scan-button">
              <LoaderCircle size={20} className="button-spinner" />
              Checking your attendance...
            </button>
          ) : (
            <button type="button" className="attendance-scan-button"
              disabled={scanning || authLoading || !user} onClick={startScanner}>
              <Camera size={20} /> {scanning ? "Scanning..." : "Open Camera"}
            </button>
          )
        )}

        <button type="button"
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-rose-300 hover:text-rose-700 disabled:opacity-50"
          disabled={verifying}
          onClick={() => void changeMode(mode === "qr" ? "code" : "qr")}>
          {mode === "qr" ? <><Keyboard size={18} /> Enter code instead</> :
            <><QrCode size={18} /> Scan QR instead</>}
        </button>
      </section>
    </main>
  );
}
