import test from "node:test";
import assert from "node:assert/strict";
import { periodBounds, summarize } from "../src/services/engagementAnalytics.mjs";

test("reporting periods use Monday-based weeks and calendar month/year", () => {
  assert.deepEqual(periodBounds("weekly", new Date("2026-10-29T00:00:00Z")), {start:"2026-10-26",end:"2026-11-02"});
  assert.deepEqual(periodBounds("monthly", new Date("2026-10-29T00:00:00Z")), {start:"2026-10-01",end:"2026-11-01"});
  assert.deepEqual(periodBounds("yearly", new Date("2026-10-29T00:00:00Z")), {start:"2026-01-01",end:"2027-01-01"});
});
test("counts unique verified attendance per student and workshop, not registrations or sessions", () => {
  const workshops=[
    {id:"a",title:"Robotics",startDate:"2026-10-10",endDate:null,programArea:"STEM",capacity:20},
    {id:"b",title:"Art",startDate:"2026-10-12",endDate:null,programArea:"Art",capacity:15},
    {id:"c",title:"Future",startDate:"2026-11-10",endDate:null,programArea:"STEM"},
  ];
  const registrations=[
    {workshopId:"a",studentId:"1",attendanceStatus:"verified",status:"completed"},
    {workshopId:"a",studentId:"1",attendanceStatus:"verified",status:"completed"},
    {workshopId:"a",studentId:"2",attendanceStatus:"pending",status:"registered"},
    {workshopId:"b",studentId:"3",attendanceStatus:"verified",status:"completed"},
    {workshopId:"b",studentId:"4",attendanceStatus:"verified",status:"completed"},
    {workshopId:"c",studentId:"5",attendanceStatus:"verified",status:"completed"},
  ];
  const result=summarize(workshops,registrations,"2026-10-01","2026-11-01","2026-10-29");
  assert.equal(result.summary.workshopsHeld,2);
  assert.equal(result.summary.verifiedAttendance,3);
  assert.equal(result.summary.registrations,4);
  assert.equal(result.summary.attendanceRate,75);
  assert.equal(result.workshops[0].workshopId,"b");
  assert.equal(result.workshops[1].attended,1);
  assert.equal(result.workshops[1].absent,1);
});
test("excludes undated future workshops and never counts pending scans", () => {
  const result=summarize([
    {id:"x",title:"No date"},{id:"y",title:"Tomorrow",startDate:"2026-10-30"},
    {id:"z",title:"Past",startDate:"2026-10-04"},
  ],[
    {workshopId:"z",studentId:"1",attendanceStatus:"pending",status:"completed"},
  ],"2026-10-01","2026-11-01","2026-10-29");
  assert.equal(result.summary.workshopsHeld,1);
  assert.equal(result.summary.verifiedAttendance,0);
  assert.equal(result.workshops[0].registered,1);
});
