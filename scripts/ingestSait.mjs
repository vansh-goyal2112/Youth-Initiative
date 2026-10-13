import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { getCosmosContainer } from "../src/services/cosmos.js";
import {
  SAIT_DATASETS,
  runSaitIngestion,
} from "../src/services/saitIngestion.js";

const USAGE = `Usage: npm run ingest:sait -- [options]

  --dry-run          Fetch, normalize and validate only. Nothing is sent to Azure.
  --only <dataset>   programs | workshops (default: both)
  --limit <n>        Process only the first n pages of each dataset (testing)
  --output <file>    Write the collected records and report to a JSON file
  --help             Show this message`;

function parseOptions() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      only: { type: "string" },
      limit: { type: "string" },
      output: { type: "string" },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help) {
    console.info(USAGE);
    process.exit(0);
  }

  if (values.only && !SAIT_DATASETS.includes(values.only)) {
    throw new Error(`--only must be one of: ${SAIT_DATASETS.join(", ")}.`);
  }

  const limit = values.limit === undefined ? Infinity : Number(values.limit);

  if (!(limit === Infinity || (Number.isInteger(limit) && limit > 0))) {
    throw new Error("--limit must be a positive integer.");
  }

  return {
    dryRun: values["dry-run"],
    datasets: values.only ? [values.only] : SAIT_DATASETS,
    limit,
    output: values.output,
  };
}

function printReport(report) {
  console.info(`\n== ${report.dataset} (container: ${report.container}) ==`);
  console.info(`  discovered          : ${report.discovered}`);
  console.info(`  validated           : ${report.validated}`);
  console.info(`  duplicates removed  : ${report.duplicatesRemoved}`);

  if (report.dryRun) {
    console.info(`  ready to upsert     : ${report.records.length} (dry run, nothing written)`);
  } else {
    console.info(`  inserted            : ${report.inserted}`);
    console.info(`  updated             : ${report.updated}`);
    console.info(`  unchanged           : ${report.unchanged}`);
    console.info(`  already present     : ${report.matchedExisting} (same SAIT page stored under another id; left untouched)`);
  }

  console.info(`  skipped (total)     : ${report.skipped}`);
  console.info(`  failed              : ${report.failed}`);

  for (const failure of report.failures.slice(0, 20)) {
    console.error(
      `    - [${failure.stage}] ${failure.url || failure.id || ""} ${failure.reason}`
    );
  }

  if (report.failures.length > 20) {
    console.error(`    ... and ${report.failures.length - 20} more (see --output).`);
  }
}

async function main() {
  const options = parseOptions();

  if (!options.dryRun && !process.env.COSMOS_ENDPOINT) {
    throw new Error(
      "COSMOS_ENDPOINT is not set, so nothing can be uploaded. Set it (and COSMOS_DATABASE_NAME if needed), or use --dry-run."
    );
  }

  console.info(
    options.dryRun
      ? "DRY RUN: collecting records only; Azure will not be contacted."
      : `Uploading to Cosmos DB ${process.env.COSMOS_ENDPOINT} (database ${process.env.COSMOS_DATABASE_NAME || "YouthInitiative"}).`
  );

  const reports = await runSaitIngestion({
    datasets: options.datasets,
    dryRun: options.dryRun,
    limit: options.limit,
    getContainer: getCosmosContainer,
  });

  reports.forEach(printReport);

  if (options.output) {
    await mkdir(path.dirname(path.resolve(options.output)), { recursive: true });
    await writeFile(
      options.output,
      JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)
    );
    console.info(`\nWrote ${options.output}`);
  }

  const failed = reports.reduce((total, report) => total + report.failed, 0);
  const written = reports.reduce(
    (total, report) => total + report.inserted + report.updated + report.unchanged,
    0
  );

  console.info(
    options.dryRun
      ? "\nDry run finished. No data was uploaded to Azure."
      : failed === 0
        ? `\nAzure ingestion succeeded: ${written} records are present in Cosmos DB.`
        : `\nAzure ingestion finished WITH ${failed} FAILURE(S); only the counts above were confirmed by Cosmos DB.`
  );

  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("SAIT ingestion failed:", error.message);
  process.exitCode = 2;
});
