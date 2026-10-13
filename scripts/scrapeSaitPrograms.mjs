import {
  deduplicateSaitPrograms,
} from "../src/services/saitProgramNormalization.js";
import {
  scrapeSaitPrograms,
} from "../src/services/saitProgramScraper.js";
import {
  upsertSaitPrograms,
} from "../src/services/saitProgramService.js";

async function main() {
  const programs = deduplicateSaitPrograms(
    await scrapeSaitPrograms()
  );
  const savedPrograms = await upsertSaitPrograms(programs);

  console.info(
    `Upserted ${savedPrograms.length} SAIT programs to the saitPrograms Cosmos container.`
  );
}

main().catch((error) => {
  console.error("SAIT program scrape failed:", error);
  process.exitCode = 1;
});
