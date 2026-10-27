import { parseArgs } from "node:util";
import { collectSaitWorkshops } from "../src/services/saitWorkshopIngestion.js";
import { collectSaitPrograms } from "../src/services/saitProgramScraper.js";
import { recommendSaitPrograms } from "../src/services/saitProgramRecommendations.js";

const DIVIDER = "--------------------------------------------------------------------------------";
const DOUBLE_DIVIDER = "================================================================================";

async function main() {
  const { values } = parseArgs({
    options: {
      profile: { type: "string", default: "tech" },
      limit: { type: "string", default: "5" },
    },
  });

  console.log(DOUBLE_DIVIDER);
  console.log("SOUTHERN ALBERTA INSTITUTE OF TECHNOLOGY (SAIT) - CAPSTONE DEMONSTRATION");
  console.log("System: Automated Web Scraping, Data Ingestion & Recommendation Engine");
  console.log(DOUBLE_DIVIDER);

  // SECTION 1: WEB SCRAPING DEMONSTRATION
  console.log("\n[STAGE 1] OFFICIAL WEB SCRAPING & DATA DISCOVERY");
  console.log(DIVIDER);

  console.log("Target 1: SAIT Digital Youth Workshops (https://www.sait.ca/youth-programs)");
  const workshopScrape = await collectSaitWorkshops({ limit: 5 });
  console.log(`Status   : Discovered ${workshopScrape.discovered} active youth workshop topic tracks.`);
  console.log("Sample Discovered Workshops:");
  workshopScrape.workshops.slice(0, 3).forEach((workshop, index) => {
    console.log(`  [${index + 1}] Title    : ${workshop.title}`);
    console.log(`      Category : ${workshop.category}`);
    console.log(`      Grade    : ${workshop.grade || "Grades 7 - 12"}`);
    console.log(`      Mode     : ${workshop.learningMode}`);
    console.log(`      URL      : ${workshop.informationUrl}`);
  });

  console.log("\nTarget 2: SAIT Post-Secondary Program Catalog (https://www.sait.ca/programs-and-courses)");
  const programScrape = await collectSaitPrograms();
  console.log(`Status   : Discovered ${programScrape.discovered} degree, diploma, and certificate offerings.`);

  // SECTION 2: NORMALIZATION AND STORAGE SCHEMA READINESS
  console.log("\n[STAGE 2] DATA NORMALIZATION & AZURE COSMOS DB SCHEMA COMPLIANCE");
  console.log(DIVIDER);
  console.log("Documents are validated and formatted for target Azure Cosmos DB containers.");

  console.log("\nSample Document 1: Container 'workshops' (Partition Key: /id)");
  const sampleWorkshop = workshopScrape.workshops[0];
  console.log(JSON.stringify({
    id: sampleWorkshop.id,
    title: sampleWorkshop.title,
    category: sampleWorkshop.category,
    grade: sampleWorkshop.grade,
    learningMode: sampleWorkshop.learningMode,
    xpReward: sampleWorkshop.xpReward,
    informationUrl: sampleWorkshop.informationUrl,
    status: sampleWorkshop.status,
    createdAt: sampleWorkshop.createdAt,
  }, null, 2));

  console.log("\nSample Document 2: Container 'saitPrograms' (Partition Key: /id)");
  const sampleProgram = programScrape.programs[0];
  console.log(JSON.stringify({
    id: sampleProgram.id,
    title: sampleProgram.title,
    credential: sampleProgram.credential,
    category: sampleProgram.category,
    skills: sampleProgram.skills,
    subjects: sampleProgram.subjects,
    relatedWorkshopCategories: sampleProgram.relatedWorkshopCategories,
    relatedWorkshopTopics: sampleProgram.relatedWorkshopTopics,
    status: sampleProgram.status,
  }, null, 2));

  // SECTION 3: RECOMMENDATION ENGINE EVALUATION
  console.log("\n[STAGE 3] INTELLIGENT PATHWAY RECOMMENDATION ENGINE");
  console.log(DIVIDER);

  const studentProfiles = {
    tech: {
      name: "Alex Patel (Technology & Software Stream)",
      grade: "11",
      interests: ["coding", "artificial intelligence", "technology"],
      completedWorkshops: [
        workshopScrape.workshops.find((w) => w.id.includes("coding")) || workshopScrape.workshops[0],
      ],
    },
    design: {
      name: "Jordan Lee (Interactive Design & Media Stream)",
      grade: "12",
      interests: ["design", "creative", "media"],
      completedWorkshops: [
        workshopScrape.workshops.find((w) => w.id.includes("3d-printing")) || workshopScrape.workshops[0],
      ],
    },
    trades: {
      name: "Marcus Vance (Applied Technology & Engineering Stream)",
      grade: "12",
      interests: ["engineering", "trades", "construction"],
      completedWorkshops: [
        workshopScrape.workshops.find((w) => w.id.includes("electronics")) || workshopScrape.workshops[0],
      ],
    },
  };

  const student = studentProfiles[values.profile] || studentProfiles.tech;

  console.log("Student Profile Input:");
  console.log(`  Name                : ${student.name}`);
  console.log(`  Current Grade       : Grade ${student.grade}`);
  console.log(`  Declared Interests  : ${student.interests.join(", ")}`);
  console.log(`  Completed Workshops : ${student.completedWorkshops.map((w) => w.title).join(", ")}`);

  console.log("\nExecuting multi-factor scoring algorithm across SAIT catalog...");
  const recommendations = recommendSaitPrograms({
    student,
    completedWorkshops: student.completedWorkshops,
    programs: programScrape.programs,
    limit: parseInt(values.limit, 10),
  });

  console.log(`\nRanked Post-Secondary Recommendations (Top ${recommendations.length}):`);
  console.log(DIVIDER);

  recommendations.forEach((rec, index) => {
    console.log(`\n${index + 1}. ${rec.program.title}`);
    console.log(`   Match Confidence Score : ${rec.score} / 100`);
    console.log(`   Official Information   : ${rec.program.informationUrl}`);
    console.log("   Evaluation Reasons:");
    rec.reasons.forEach((reason) => {
      console.log(`     - ${reason}`);
    });
  });

  console.log("\n" + DOUBLE_DIVIDER);
  console.log("SUMMARY: Demonstration completed successfully.");
  console.log(DOUBLE_DIVIDER);
}

main().catch((error) => {
  console.error("Execution failed:", error);
  process.exit(1);
});
