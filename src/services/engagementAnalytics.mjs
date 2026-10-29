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

function isVerifiedInPeriod(registration, start, end) {
  if (registration.attendanceStatus !== "verified" || registration.status !== "completed") return false;
  const eventDate = String(registration.attendedAt || registration.completedAt || "").slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(eventDate) && eventDate >= start && eventDate < end;
}

export function summarize(workshops, registrations, start, end, now) {
  const bucket = new Map();
  for (const w of workshops) {
    const scheduledDate = String(w.endDate || w.startDate || "").slice(0,10);
    const scheduledInPeriod = /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) &&
      scheduledDate >= start && scheduledDate < end && scheduledDate <= now;
    const attendedHere = registrations.some(r => r.workshopId === w.id && isVerifiedInPeriod(r,start,end));
    if (!scheduledInPeriod && !attendedHere) continue;
    const lastCheckin = registrations.filter(r => r.workshopId === w.id && isVerifiedInPeriod(r,start,end))
      .map(r => String(r.attendedAt || r.completedAt).slice(0,10)).sort().at(-1);
    bucket.set(w.id,{
      workshopId:w.id,title:w.title || "Untitled workshop",programArea:w.programArea || "Uncategorized",
      date:scheduledInPeriod ? scheduledDate : lastCheckin || "—",
      capacity:Number.isFinite(Number(w.capacity)) && Number(w.capacity)>0 ? Number(w.capacity):null,
      registrations:new Set(),attendees:new Set(),
    });
  }
  for (const r of registrations) {
    const row=bucket.get(r.workshopId);
    if (!row || !r.studentId) continue;
    row.registrations.add(r.studentId);
    if (isVerifiedInPeriod(r,start,end)) row.attendees.add(r.studentId);
  }
  const rows=[...bucket.values()].map(w=>({
    workshopId:w.workshopId,title:w.title,programArea:w.programArea,date:w.date,
    registered:w.registrations.size,attended:w.attendees.size,
    absent:Math.max(0,w.registrations.size-w.attendees.size),
    attendanceRate:w.registrations.size ? Math.round(100*w.attendees.size/w.registrations.size):0,
    capacity:w.capacity,
  })).sort((a,b)=>b.attended-a.attended || b.registered-a.registered || a.title.localeCompare(b.title));
  const verifiedAttendance=rows.reduce((total,w)=>total+w.attended,0);
  const totalRegistered=rows.reduce((total,w)=>total+w.registered,0);
  return {
    workshops:rows,
    summary:{
      workshopsHeld:rows.length,verifiedAttendance,registrations:totalRegistered,
      attendanceRate:totalRegistered?Math.round(100*verifiedAttendance/totalRegistered):0,
      topWorkshop:rows[0] || null,
    },
  };
}
