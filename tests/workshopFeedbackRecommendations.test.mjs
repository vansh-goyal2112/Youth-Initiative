import test from "node:test";
import assert from "node:assert/strict";
import {recommendYouthWorkshops} from "../src/utils/youthWorkshopRecommendations.mjs";

test("upcoming workshop recommendations are not surveys or generic sorting",()=>{
  const workshops=[
    {id:"ai",title:"Artificial Intelligence",category:"Technology",learningMode:"online",status:"active",grade:"Grades 6 - 12"},
    {id:"welding",title:"Welding",category:"Trades",learningMode:"in-person",status:"active",grade:"Grades 6 - 12"},
    {id:"deleted",title:"Old AI",category:"Technology",status:"inactive"}
  ];
  const matches=recommendYouthWorkshops({
    workshops,
    registrations:[{workshopId:"historical",status:"completed",workshopSnapshot:{category:"Technology"}}],
    student:{schoolGrade:"8",interests:["artificial intelligence"],learningMode:"online"}
  });
  assert.equal(matches[0].id,"ai");
  assert.ok(matches[0].recommendationReasons.length);
  assert.ok(!matches.some(w=>w.id==="deleted"));
});
