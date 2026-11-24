import test from "node:test";
import assert from "node:assert/strict";
import { schoolInterests, interestChoices, experienceSchools } from "../src/utils/schoolInterests.mjs";
import { normalizeWorkshopTags } from "../src/utils/workshopCatalogueFields.mjs";
import { recommendYouthWorkshops } from "../src/utils/youthWorkshopRecommendations.mjs";
import { recommendWorkshops } from "../src/services/workshopRecommendations.js";
import { recommendSaitPrograms } from "../src/services/saitProgramRecommendations.js";
import { normalizeSaitProgram } from "../src/services/saitProgramNormalization.js";

const examples = ["Solar energy", "Medical sonography", "Exploring forensics", "Software development", "Accounting", "Carpentry", "Baking", "Hotel management", "Tourism management", "Precision machining", "Robotics", "Aircraft maintenance"];
for (const [index, school] of schoolInterests.entries()) {
  test(school + " works across student interests, staff tags, experiences and pathways", () => {
    const title = examples[index];
    const student = { schoolGrade: "8", interests: [school.toLowerCase()] };
    const workshop = { id: "test", title, status: "active", minGrade: 6, maxGrade: 12 };
    assert.ok(interestChoices().includes(school));
    assert.deepEqual(normalizeWorkshopTags([school.toLowerCase()]), [school]);
    assert.ok(experienceSchools(workshop).includes(school));
    assert.ok(recommendYouthWorkshops({workshops:[workshop], student})[0].recommendationReasons.some(r=>r.includes(school.toLowerCase())));
    assert.ok(recommendWorkshops({student, workshops:[workshop], completedWorkshops:[]})[0].reasons.some(r=>r.includes(school.toLowerCase())));
    const program = normalizeSaitProgram({ title, description:title, informationUrl:"https://www.sait.ca/programs-and-courses/test" });
    assert.equal(recommendSaitPrograms({ student, programs:[program], completedWorkshops:[] })[0].matchLabel,"Good match");
  });
}
test("legacy choices stay editable and ambiguous experiences can be reviewed",()=>{
  assert.equal(interestChoices().length,12);
  assert.deepEqual(experienceSchools({title:"Medical Laboratory Technology"}),["Health"]);
  assert.deepEqual(experienceSchools({title:"Summer session",interestTags:["Health","Coding"]}),["Health","Technology"]);
  assert.ok(interestChoices(["skilled trades"]).includes("Skilled Trades"));
  assert.deepEqual(experienceSchools({title:"Exploring skilled trades", interestTags:["Skilled Trades"]}),[]);
  assert.deepEqual(experienceSchools({title:"Introduction to coding",interestTags:["Business"]}),["Business"]);
  assert.deepEqual(experienceSchools({title:"After school",interestTags:["Coding"]}),["Technology"]);
});

test("completion tags support a related pathway without claiming a specific topic match", () => {
  const program = normalizeSaitProgram({ title: "Solar Energy", description: "Explore renewable energy.",
    informationUrl: "https://www.sait.ca/programs-and-courses/test" });
  const results = recommendSaitPrograms({ student: { schoolGrade: "8", interests: [] },
    programs: [program], completedWorkshops: [{ id: "visit", title: "School visit", interestTags: ["Energy"] }] });
  assert.equal(results[0].matchLabel, "Good match");
  assert.ok(results[0].reasons.some(reason => reason.includes("energy")));
});

test("changing a school tag updates both experience recommendation paths", () => {
  const student = { schoolGrade: "8", interests: ["tourism"] };
  const workshop = { id: "visit", title: "Campus visit", grade: "Grades 6-12", status: "active" };
  for (const [tag, matches] of [["Tourism", true], ["Health", false]]) {
    const workshops = [{ ...workshop, interestTags: [tag] }];
    const home = recommendYouthWorkshops({ workshops, student });
    const api = recommendWorkshops({ workshops, student, completedWorkshops: [] });
    assert.equal(home[0].recommendationReasons.some(reason => reason.includes("tourism")), matches);
    assert.equal(api.some(item => item.reasons.some(reason => reason.includes("tourism"))), matches);
  }
});
