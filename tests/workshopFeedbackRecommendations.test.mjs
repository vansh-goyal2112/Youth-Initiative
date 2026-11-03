import test from "node:test";
import assert from "node:assert/strict";
import {FEEDBACK_QUESTIONS,validateWorkshopFeedback,WORKSHOP_FEEDBACK_XP} from "../src/services/workshopFeedback.mjs";
import {recommendYouthWorkshops} from "../src/utils/youthWorkshopRecommendations.mjs";

test("feedback includes five short questions and rewards 20 XP",()=>{
  assert.equal(FEEDBACK_QUESTIONS.length,5);
  assert.equal(WORKSHOP_FEEDBACK_XP,20);
  const answers=Object.fromEntries(FEEDBACK_QUESTIONS.map(q=>[q.id,q.options[0]]));
  assert.ok(validateWorkshopFeedback(answers,""));
  assert.ok(validateWorkshopFeedback(answers,"Students would enjoy more hands-on learning."));
  assert.equal(validateWorkshopFeedback({...answers,enjoyment:"fake"},""),false);
  assert.equal(validateWorkshopFeedback(answers,"x".repeat(501)),false);
});

test("upcoming workshop recommendations are not surveys or generic sorting",()=>{
  const workshops=[
    {id:"ai",title:"Artificial Intelligence",category:"Technology",learningMode:"online",status:"active"},
    {id:"welding",title:"Welding",category:"Trades",learningMode:"in-person",status:"active"},
    {id:"deleted",title:"Old AI",category:"Technology",status:"inactive"}
  ];
  const matches=recommendYouthWorkshops({
    workshops,
    registrations:[{workshopId:"historical",status:"completed",workshopSnapshot:{category:"Technology"}}],
    student:{interests:["artificial intelligence"],learningMode:"online"}
  });
  assert.equal(matches[0].id,"ai");
  assert.ok(matches[0].recommendationReasons.length);
  assert.ok(!matches.some(w=>w.id==="deleted"));
});
