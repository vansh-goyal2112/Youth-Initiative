import test from "node:test";
import assert from "node:assert/strict";
import { formatWorkshopDate, getWorkshopSchedule, workshopDateRange } from "../src/utils/workshopDate.mjs";
test("dates are optional and formatted as day month year without timezone drift", () => {
  assert.equal(formatWorkshopDate(null), "");
  assert.equal(formatWorkshopDate(""), "");
  assert.equal(formatWorkshopDate("2026-11-06"), "6 Nov 2026");
  assert.equal(formatWorkshopDate("2026-11-06T00:00:00Z"), "6 Nov 2026");
  assert.equal(formatWorkshopDate("2026-02-30"), "");
  assert.equal(workshopDateRange({}), "");
});
test("scheduled workshops use the next active session when the parent has no date", () => {
 const workshop={id:"a",startDate:null,sessions:[
  {id:"past",startDate:"2026-11-10",status:"active"},
  {id:"next",startDate:"2026-12-05",status:"active"},
  {id:"archived",startDate:"2026-11-20",status:"archived"}
 ]};
 const today = new Date("2026-11-17T12:00:00Z");
 assert.equal(getWorkshopSchedule(workshop,null,today).startDate,"2026-12-05");
 assert.equal(workshopDateRange(getWorkshopSchedule(workshop,null,today)),"5 Dec 2026");
 assert.equal(getWorkshopSchedule(workshop,"past",today).startDate,"2026-11-10");
 assert.equal(workshopDateRange({startDate:"2026-12-05",endDate:"2026-12-07"}),"5 Dec 2026 – 7 Dec 2026");
});

test("archived sessions never leak old parent dates or times into student cards", () => {
 const workshop = {
  startDate: "2026-11-06", endDate:"2026-11-07", time:"9:00",
  sessions:[{id:"old",status:"archived",startDate:"2026-11-06",endDate:"2026-11-07",time:"9:00"}]
 };
 assert.deepEqual(getWorkshopSchedule(workshop,null,new Date("2026-11-17T12:00:00Z")),{
  startDate:null,endDate:null,time:""
 });
 assert.equal(workshopDateRange(getWorkshopSchedule(workshop)),"");
});
test("an active session supplies its own date and time, not stale legacy values", () => {
 const workshop = {
  startDate:"2026-11-06",endDate:"2026-11-07",time:"9:00",
  sessions:[{id:"dec",status:"active",startDate:"2026-12-05",time:"13:00"}]
 };
 const schedule=getWorkshopSchedule(workshop,null,new Date("2026-11-17T12:00:00Z"));
 assert.deepEqual(schedule,{startDate:"2026-12-05",endDate:null,time:"13:00"});
 assert.equal(workshopDateRange(schedule),"5 Dec 2026");
});
