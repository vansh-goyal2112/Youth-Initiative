import { parseArgs } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { collectSaitWorkshops } from "../src/services/saitWorkshopIngestion.js";
import { collectSaitPrograms } from "../src/services/saitProgramScraper.js";
import { recommendSaitPrograms } from "../src/services/saitProgramRecommendations.js";

const BANNER = `
========================================================================
🚀 SAIT CAPSTONE PROJECT DEMONSTRATION
   1. Web Scraping & Ingestion Pipeline
   2. Workshop & Post-Secondary Pathway Recommendation Engine
========================================================================
`;

async function main() {
  console.log(BANNER);

  const { values } = parseArgs({
    options: {
      profile: { type: "string", default: "tech" },
      limit: { type: "string", default: "5" },
    },
  });

  // STEP 1: DEMONSTRATE SCRAPING
  console.log("📍 [STEP 1] SCRAPING DATA FROM OFFICIAL SAIT SITES...\n");
  
  console.log("-> Scraping SAIT Digital Youth workshops (https://www.sait.ca/youth-programs)...");
  const workshopScrape = await collectSaitWorkshops({ limit: 5 });
  console.log(`   ✅ Discovered ${workshopScrape.discovered} youth workshops. Sample:`);
  workshopScrape.workshops.slice(0, 3).forEach((w, i) => {
    console.log(`      ${i + 1}. [${w.category}] ${w.title} (${w.grade || "All Grades"})`);
  });

  console.log("\n-> Scraping SAIT Post-Secondary Programs (https://www.sait.ca/programs-and-courses)...");
  const programScrape = await collectSaitPrograms();
  console.log(`   ✅ Discovered ${programScrape.discovered} post-secondary programs across degrees, diplomas, and certificates.`);

  // STEP 2: DEMONSTRATE DATA SCHEMA & STORAGE READINESS
  console.log("\n------------------------------------------------------------------------");
  console.log("📍 [STEP 2] NORMALIZATION & AZURE COSMOS DB STORAGE SCHEMA...\n");
  console.log("-> Workshop Record ready for Cosmos DB container 'workshops':");
  console.log(JSON.stringify(workshopScrape.workshops[0], null, 2));

  console.log("\n-> Program Record ready for Cosmos DB container 'saitPrograms':");
  console.log(JSON.stringify(programScrape.programs[0], null, 2));

  // STEP 3: DEMONSTRATE RECOMMENDATIONS
  console.log("\n------------------------------------------------------------------------");
  console.log("📍 [STEP 3] RECOMMENDATION ENGINE SIMULATION FOR STUDENT PROFILE...\n");

  const studentProfiles = {
    tech: {
      name: "Alex (Tech & AI Track)",
      grade: "12",
      interests: ["coding", "artificial intelligence", "technology"],
      completedWorkshops: [
        workshopScrape.workshops.find(w => w.id.includes("coding")) || workshopScrape.workshops[0]
      ]
    },
    design: {
      name: "Jordan (Creative Design Track)",
      grade: "11",
      interests: ["design", "creative"],
      completedWorkshops: [
        workshopScrape.workshops.find(w => w.id.includes("3d-printing")) || workshopScrape.workshops[0]
      ]
    }
  };

  const student = studentProfiles[values.profile] || studentProfiles.tech;

  console.log(`👤 Student: ${student.name}`);
  console.log(`   Grade: ${student.grade}`);
  console.log(`   Interests: ${student.interests.join(", ")}`);
  console.log(`   Completed Workshop: ${student.completedWorkshops.map(w => w.title).join(", ")}`);

  console.log("\n-> Evaluating match scores across SAIT Post-Secondary Catalog...");
  const recommendations = recommendSaitPrograms({
    student,
    completedWorkshops: student.completedWorkshops,
    programs: programScrape.programs,
    limit: parseInt(values.limit, 10),
  });

  console.log(`\n🎯 TOP ${recommendations.length} RECOMMENDED FUTURE PATHWAYS (AFTER GRADE 12):\n`);

  recommendations.forEach((rec, idx) => {
    console.log(`${idx + 1}. 🎓 ${rec.program.title} [Match Score: ${rec.score}/100]`);
    console.log(`   🔗 Info: ${rec.program.informationUrl}`);
    console.log("   💡 Explainable Reasons:");
    rec.reasons.forEach(r => console.log(`      ✔ ${r}`));
    console.log("");
  });

  console.log("========================================================================");
  console.log("🎉 DEMO COMPLETE — Ready for Capstone Presentation!");
  console.log("========================================================================");
}

main().catch(err => {
  console.error("Demo failed:", err);
  process.exit(1);
});
