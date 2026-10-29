export function periodBounds(period, anchor) {
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  if (period === "weekly") {
    const day = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - day);
  } else if (period === "monthly") start.setUTCDate(1);
  else { start.setUTCMonth(0); start.setUTCDate(1); }
  const end = new Date(start);
  if (period === "weekly") end.setUTCDate(end.getUTCDate() + 7);
  else if (period === "monthly") end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function isVerified(registration) {
  return registration.attendanceStatus === "verified" && registration.status === "completed";
}

export function summarize(workshops, registrations, start, end, now) {
  const eligible = workshops.filter(w => {
    const date = String(w.endDate || w.startDate || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= start && date < end && date <= now;
  });
  const bucket = new Map(eligible.map(w => [w.id, {
    workshopId: w.id, title: w.title || "Untitled workshop", programArea: w.programArea || "Uncategorized",
    date: String(w.endDate || w.startDate).slice(0,10), capacity: Number.isFinite(Number(w.capacity)) && Number(w.capacity) > 0 ? Number(w.capacity) : null,
    registrations: new Set(), attendees: new Set(),
  }]));
  for (const r of registrations) {
    const row = bucket.get(r.workshopId);
    if (!row || !r.studentId) continue;
    row.registrations.add(r.studentId);
    if (isVerified(r)) row.attendees.add(r.studentId);
  }
  const rows = [...bucket.values()].map(w => ({
    workshopId: w.workshopId, title: w.title, programArea: w.programArea, date: w.date,
    registered: w.registrations.size, attended: w.attendees.size,
    absent: Math.max(0, w.registrations.size - w.attendees.size),
    attendanceRate: w.registrations.size ? Math.round(100 * w.attendees.size / w.registrations.size) : 0,
    capacity: w.capacity,
  })).sort((a,b) => b.attended - a.attended || b.registered - a.registered || a.title.localeCompare(b.title));
  const totalAttended = rows.reduce((sum,row) => sum + row.attended,0);
  const totalRegistered = rows.reduce((sum,row) => sum + row.registered,0);
  return {
    workshops: rows,
    summary: {
      workshopsHeld: rows.length, verifiedAttendance: totalAttended, registrations: totalRegistered,
      attendanceRate: totalRegistered ? Math.round(100*totalAttended/totalRegistered) : 0,
      topWorkshop: rows[0] || null,
    },
  };
}
