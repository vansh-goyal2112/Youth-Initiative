import crypto from "node:crypto";

export const MANUAL_CODE_LENGTH = 4;
export const MAX_MANUAL_CODE_ATTEMPTS = 5;
export const MANUAL_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export function generateManualAttendanceCode() {
  return String(crypto.randomInt(0, 10000)).padStart(MANUAL_CODE_LENGTH, "0");
}

export function isValidManualAttendanceCode(value) {
  return typeof value === "string" && /^[0-9]{4}$/.test(value);
}

export function nextManualCodeAttempt(record, now = Date.now()) {
  const start = Date.parse(record?.windowStartedAt || "");
  const withinWindow = Number.isFinite(start) && now >= start &&
    now - start < MANUAL_ATTEMPT_WINDOW_MS;
  const attempts = withinWindow ? Number(record.attempts) || 0 : 0;
  if (attempts >= MAX_MANUAL_CODE_ATTEMPTS) {
    return { allowed: false, next: null };
  }
  return {
    allowed: true,
    next: {
      attempts: attempts + 1,
      windowStartedAt: withinWindow ? record.windowStartedAt : new Date(now).toISOString(),
    },
  };
}
