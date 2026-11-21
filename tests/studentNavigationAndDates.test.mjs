import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = path => readFileSync(new URL(path,import.meta.url),"utf8");
test("one shared Back link handles student pages without duplicated in-page controls", () => {
 assert.match(src("../src/components/common/StudentShell.jsx"),/studentBackDestination\(pathname, originPath\)/);
 assert.match(src("../src/components/common/StudentShell.jsx"),/studentBackOrigin/);
 assert.match(src("../src/components/common/StudentShell.jsx"),/historyNavigation/);
 assert.match(src("../src/components/common/StudentShell.jsx"),/anchor\.dataset\.studentBackLink/);
 assert.match(src("../src/components/common/StudentHeader.jsx"),/data-student-back-link="true"/);
 assert.doesNotMatch(src("../src/app/edit-profile/page.js"),/Back to My Profile/);
 assert.doesNotMatch(src("../src/app/scan-attendance/page.js"),/Back to Upcoming Workshops/);
 assert.doesNotMatch(src("../src/app/tasks/page.js"),/← Back to Profile/);
 assert.doesNotMatch(src("../src/app/workshops/[id]/page.js"),/router\.back\(\)/);
 assert.doesNotMatch(src("../src/app/registration-success/[id]/page.js"),/router\.back\(\)/);
});
test("My Adventure duplicate header button is removed, Journey tab remains", () => {
 const header=src("../src/components/common/StudentHeader.jsx");
 assert.doesNotMatch(header,/My Adventure/);
 assert.match(header,/href: "\/journey", label: "Journey"/);
});
test("all workshop date surfaces use the shared optional schedule", () => {
 for(const path of [
  "../src/components/workshops/WorkshopCard.js",
  "../src/app/workshops/[id]/page.js",
  "../src/app/registered-workshops/page.js",
  "../src/app/dashboard/page.js"
 ]) {
  const s=src(path);
  assert.match(s,/getWorkshopSchedule\(/,path);
  assert.doesNotMatch(s,/Date to be announced|Workshop date|To be announced/,path);
 }
});

test("admin schedule screens format dates without changing stored ISO date inputs", () => {
  const sessions=src("../src/components/admin/WorkshopSessionsPanel.jsx");
  const attendance=src("../src/app/admin/attendance/page.js");
  assert.match(sessions,/workshopDateRange\(session\)/);
  assert.match(attendance,/formatWorkshopDate\(item.startDate\)/);
});
test("archived schedules never offer an unfulfillable student registration", () => {
  const detail=src("../src/app/workshops/[id]/page.js");
  const confirm=src("../src/app/registration-success/[id]/page.js");
  assert.match(detail,/sessionsUnavailable \|\| workshop.availabilityStatus === "closed"/);
  assert.match(confirm,/managedSessions && !activeSelectedSession/);
  assert.match(confirm,/registrationUnavailable \|\|/);
  assert.match(src("../src/app/api/registrations/route.js"),/item.status === "active"/);
});
test("empty dates also hide empty or stale time rows on student screens", () => {
  const detail=src("../src/app/workshops/[id]/page.js");
  const registered=src("../src/app/registered-workshops/page.js");
  assert.match(detail,/dateLabel && schedule.time && <InformationItem/);
  assert.match(registered,/dateLabel && schedule.time && <div>/);
});

test("Home shows only Workshops, Badges and Total XP tiles without journal stamps", () => {
  const dashboard = src("../src/app/dashboard/page.js");
  const hub = src("../src/components/gamification/SkillQuestHub.jsx");
  const journey = src("../src/app/journey/page.js");
  assert.match(dashboard, /<SkillQuestHub section="level"/);
  assert.doesNotMatch(dashboard, /<SkillQuestHub section="journal"/);
  assert.doesNotMatch(journey, /<JournalStamps/);
  assert.match(hub, /<span>Workshops<\/span>/);
  assert.match(hub, /<span>Badges<\/span>/);
  assert.match(hub, /<span>Total XP<\/span>/);
  assert.equal((hub.match(/className=\{styles\.overviewStat\}/g) || []).length, 3);
  assert.doesNotMatch(hub, /Reflections|JournalStamps|milestoneStrip|stats\.reflectedCount/);
  assert.match(hub, /section === "mission"/);
});
