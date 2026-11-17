import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = path => readFileSync(new URL(path,import.meta.url),"utf8");
test("one shared Back link handles student pages without duplicated in-page controls", () => {
 assert.match(src("../src/components/common/StudentShell.jsx"),/studentBackDestination\(pathname, originPath\)/);
 assert.match(src("../src/components/common/StudentShell.jsx"),/studentBackOrigin/);
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
