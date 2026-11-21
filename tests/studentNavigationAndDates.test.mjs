import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getHomeRegisteredSchedule, getHomeWorkshopDateLabel } from "../src/utils/homeNextWorkshopSchedule.mjs";

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
  "../src/app/registered-workshops/page.js"
 ]) {
  const s=src(path);
  assert.match(s,/getWorkshopSchedule\(/,path);
  assert.doesNotMatch(s,/Date to be announced|Workshop date|To be announced/,path);
 }
 const home=src("../src/app/dashboard/page.js");
 assert.match(home,/getHomeRegisteredSchedule\(/);
 assert.match(home,/getHomeWorkshopDateLabel\(registration\)/);
 assert.match(home,/dateLabel && <div><CalendarDays/);
 assert.doesNotMatch(home,/Date to be announced|Workshop date|To be announced/);
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
  assert.doesNotMatch(dashboard, /<SkillQuestHub section="mission"/);
  assert.doesNotMatch(journey, /<JournalStamps/);
  assert.match(hub, /<span>Workshops<\/span>/);
  assert.match(hub, /<span>Badges<\/span>/);
  assert.match(hub, /<span>Total XP<\/span>/);
  assert.equal((hub.match(/className=\{styles\.overviewStat\}/g) || []).length, 3);
  assert.doesNotMatch(hub, /Reflections|JournalStamps|milestoneStrip|stats\.reflectedCount/);
  assert.match(hub, /section === "mission"/);
  assert.match(hub, /section === "all" && \(/);
  assert.match(hub, /styles\.statsOnly/);
  assert.match(src("../src/components/gamification/skillQuestHub.module.css"), /\.overview\.statsOnly \{/);
});

test("Home leads with the registered next workshop before recommendations", () => {
  const dashboard = src("../src/app/dashboard/page.js");
  assert.ok(dashboard.indexOf("dashboard-next-adventure") < dashboard.indexOf("dashboard-recommendation-section"));
  assert.match(dashboard, /daysUntilWorkshop\(getHomeRegisteredSchedule\(registration\)\.startDate\)/);
  assert.match(dashboard, /daysUntilWorkshop\(getHomeRegisteredSchedule\(first\)\.startDate\)/);
  assert.match(dashboard, /daysUntilWorkshop\(getHomeRegisteredSchedule\(second\)\.startDate\)/);
  assert.match(dashboard, /\["completed", "cancelled"\]\.includes\(registration\.status\)/);
});

test("Home no longer renders the redundant journey footer", () => {
  const dashboard = src("../src/app/dashboard/page.js");
  assert.doesNotMatch(dashboard, /dashboard-journey-cta|YOUR JOURNEY IS GROWING|View My Journey/);
  assert.match(dashboard, /<UpcomingAdventures/);
  assert.match(dashboard, /<SkillQuestHub section="level"/);
  assert.match(dashboard, /dashboard-next-adventure/);
});

test("Home next-workshop card shows the registered session date or hides it", () => {
 const workshop={
   id:"w1",startDate:"2026-11-06",
   sessions:[
     {id:"dec5",status:"active",startDate:"2026-12-05",time:"10:00"},
     {id:"dec19",status:"active",startDate:"2026-12-19"},
   ],
 };
 const registered={workshop,sessionId:"dec5",sessionSnapshot:{id:"dec5",startDate:"2026-12-05"}};
 assert.equal(getHomeWorkshopDateLabel(registered),"5 Dec 2026");
 assert.equal(getHomeRegisteredSchedule(registered).time,"10:00");
 assert.equal(getHomeWorkshopDateLabel({...registered,sessionId:"dec19"}),"19 Dec 2026");

 // The current session can be removed or archived without changing booking history.
 const changed={...workshop,sessions:[{id:"dec19",status:"active",startDate:"2026-12-19"}]};
 assert.equal(getHomeWorkshopDateLabel({...registered,workshop:changed}),"5 Dec 2026");
 assert.equal(getHomeWorkshopDateLabel({...registered,workshop:{...workshop,sessions:[{id:"dec5",status:"archived",startDate:"2026-12-05"}]}}),"5 Dec 2026");

 // Never substitute another session's date or a legacy parent placeholder.
 assert.equal(getHomeWorkshopDateLabel({...registered,workshop:changed,sessionSnapshot:null}),"");
 assert.equal(getHomeWorkshopDateLabel({workshop,sessionId:null}),"");
 assert.equal(getHomeWorkshopDateLabel({...registered,workshop:{...workshop,sessions:[{id:"dec5",status:"active",startDate:null}]},sessionSnapshot:null}),"");
 assert.equal(getHomeWorkshopDateLabel({workshop:{id:"w2",startDate:null}}),"");
 assert.equal(getHomeWorkshopDateLabel({workshop:{id:"w3",startDate:"Workshop date"}}),"");

 // Older workshops with no managed sessions still display a real date.
 assert.equal(getHomeWorkshopDateLabel({workshop:{id:"legacy",startDate:"2026-12-05"}}),"5 Dec 2026");
 assert.equal(getHomeWorkshopDateLabel({workshop:{id:"w4",sessions:[]},sessionSnapshot:{startDate:"2026-12-05"}}),"5 Dec 2026");
});
