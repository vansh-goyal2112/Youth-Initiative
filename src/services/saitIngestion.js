import {
  deduplicateSaitPrograms,
  validateSaitProgram,
} from "./saitProgramNormalization.js";
import {
  collectSaitPrograms,
} from "./saitProgramScraper.js";
import {
  SAIT_PROGRAMS_CONTAINER,
} from "./saitProgramService.js";
import {
  SAIT_WORKSHOPS_CONTAINER,
  collectSaitWorkshops,
  deduplicateSaitWorkshops,
  validateSaitWorkshop,
} from "./saitWorkshopIngestion.js";

const FATAL_NETWORK_CODES = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
]);

const AUTH_ERROR_NAMES = new Set([
  "CredentialUnavailableError",
  "AuthenticationError",
  "AggregateAuthenticationError",
]);

export function describeCosmosError(error, containerName) {
  const code = error?.code ?? error?.statusCode;

  if (AUTH_ERROR_NAMES.has(error?.name)) {
    return {
      fatal: true,
      message: `Azure authentication failed (${error.name}). Run "az login" locally or check the managed identity: ${error.message}`,
    };
  }

  if (code === 401 || code === 403) {
    return {
      fatal: true,
      message: `Cosmos DB rejected the credentials (HTTP ${code}). The identity needs a data-plane role (e.g. Cosmos DB Built-in Data Contributor) on the account.`,
    };
  }

  if (code === 404) {
    return {
      fatal: true,
      message: `Cosmos DB database or container "${containerName}" was not found. Create it with partition key /id.`,
    };
  }

  if (FATAL_NETWORK_CODES.has(code)) {
    return {
      fatal: true,
      message: `Cannot reach Cosmos DB (${code}). Check COSMOS_ENDPOINT and your network.`,
    };
  }

  return {
    fatal: false,
    message: `Cosmos DB error${code ? ` (${code})` : ""}: ${error?.message || error}`,
  };
}

function isNotFoundError(error) {
  return error?.code === 404 || error?.statusCode === 404;
}

function stripSystemFields(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !key.startsWith("_"))
  );
}

function comparableContent(record) {
  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...content
  } = stripSystemFields(record);

  return JSON.stringify(
    Object.fromEntries(
      Object.entries(content).sort(([first], [second]) =>
        first.localeCompare(second)
      )
    )
  );
}

export function getPartitionKeyValue(record, paths = ["/id"]) {
  const path = paths[0] || "/id";

  return path
    .split("/")
    .filter(Boolean)
    .reduce((value, segment) => value?.[segment], record);
}

export async function readPartitionKeyPaths(container) {
  const { resource } = await container.read();

  return resource?.partitionKey?.paths?.length
    ? resource.partitionKey.paths
    : ["/id"];
}

export async function upsertRecords(
  records,
  container,
  {
    now = () => new Date(),
    partitionKeyPaths = ["/id"],
    // Optional hooks used for containers that already hold curated documents.
    findMatchingByAlternateKey = null,
    mergeExisting = null,
  } = {}
) {
  const result = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    matchedExisting: 0,
    failures: [],
  };

  for (const [index, record] of records.entries()) {
    try {
      let existing = null;

      try {
        const response = await container
          .item(record.id, getPartitionKeyValue(record, partitionKeyPaths))
          .read();
        existing = response.resource || null;
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }

      if (!existing && findMatchingByAlternateKey?.(record)) {
        // Same official page already stored under another ID: leave it alone.
        result.matchedExisting += 1;
        continue;
      }

      const next = existing && mergeExisting
        ? mergeExisting(existing, record)
        : { ...record, createdAt: existing?.createdAt || record.createdAt };

      if (existing && comparableContent(existing) === comparableContent(next)) {
        result.unchanged += 1;
        continue;
      }

      await container.items.upsert({
        ...stripSystemFields(next),
        updatedAt: now().toISOString(),
      });

      if (existing) {
        result.updated += 1;
      } else {
        result.inserted += 1;
      }
    } catch (error) {
      const { fatal, message } = describeCosmosError(
        error,
        container.id || "container"
      );

      if (fatal) {
        // Abort: every remaining write would fail the same way.
        for (const pending of records.slice(index)) {
          result.failures.push({
            id: pending.id,
            stage: "write",
            reason: pending === record ? message : `Not attempted: ${message}`,
          });
        }

        break;
      }

      result.failures.push({ id: record.id, stage: "write", reason: message });
    }
  }

  return result;
}

async function loadExistingUrls(container) {
  const { resources } = await container.items
    .query("SELECT c.id, c.informationUrl FROM c")
    .fetchAll();

  return new Set(
    resources.map((document) => document.informationUrl).filter(Boolean)
  );
}

// For workshops only scraper-owned text fields may change on an existing document.
function mergeWorkshop(existing, record) {
  const isScrapedRecord = existing.importedFromExcel === false;
  const mergeScrapedField = (field, fallback = null) => {
    if (isScrapedRecord) {
      return Object.hasOwn(record, field) ? record[field] : fallback;
    }

    return record[field] ?? existing[field] ?? fallback;
  };
  const updates = {
    description: record.description || existing.description,
    grade: mergeScrapedField("grade"),
    audience: mergeScrapedField("audience", "students"),
    availabilityStatus: mergeScrapedField("availabilityStatus", "unknown"),
    minAge: mergeScrapedField("minAge"),
    maxAge: mergeScrapedField("maxAge"),
    minGrade: mergeScrapedField("minGrade"),
    maxGrade: mergeScrapedField("maxGrade"),
    informationUrl: record.informationUrl || existing.informationUrl,
    registrationUrl: record.registrationUrl || existing.registrationUrl,
    image: mergeScrapedField("image"),
    learningMode: mergeScrapedField("learningMode"),
    location: mergeScrapedField("location"),
    startDate: mergeScrapedField("startDate"),
    endDate: mergeScrapedField("endDate"),
    time: mergeScrapedField("time", ""),
  };

  return {
    ...stripSystemFields(existing),
    ...updates,
  };
}
function reasonOf(error) {
  return error?.cause?.code
    ? `${error.message} (${error.cause.code})`
    : error?.message || String(error);
}

async function runDataset({
  name,
  containerName,
  collect,
  validate,
  deduplicate,
  getContainer,
  usesExistingDocuments = false,
  dryRun,
  now,
}) {
  const report = {
    dataset: name,
    container: containerName,
    dryRun,
    discovered: 0,
    validated: 0,
    duplicatesRemoved: 0,
    unchanged: 0,
    matchedExisting: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    failures: [],
    records: [],
  };

  let collected;

  try {
    collected = await collect();
  } catch (error) {
    report.failed = 1;
    report.failures.push({
      stage: "discovery",
      reason: `Could not discover ${name}: ${reasonOf(error)}`,
    });
    return report;
  }

  report.discovered = collected.discovered;

  for (const { url, error } of collected.failures) {
    report.failures.push({ url, stage: "fetch-or-parse", reason: reasonOf(error) });
  }

  const valid = [];

  for (const record of collected.records) {
    const validation = validate(record);

    if (validation.valid) {
      valid.push(record);
    } else {
      report.failures.push({
        id: record?.id,
        stage: "validation",
        reason: validation.errors.join(" "),
      });
    }
  }

  report.validated = valid.length;
  report.records = deduplicate(valid);
  report.duplicatesRemoved = valid.length - report.records.length;
  report.failed = report.failures.length;

  if (dryRun) {
    report.skipped = report.duplicatesRemoved;
    return report;
  }

  if (report.failed > 0) {
    report.skipped =
      report.duplicatesRemoved + report.records.length;
    return report;
  }

  let container;

  try {
    container = getContainer(containerName);
  } catch (error) {
    report.failures.push({
      stage: "connect",
      reason: `Cosmos DB connection could not be created: ${error.message}`,
    });
    report.failed = report.failures.length;
    return report;
  }

  let writeOptions = { now };

  try {
    const partitionKeyPaths = await readPartitionKeyPaths(container);
    writeOptions = { now, partitionKeyPaths };

    if (usesExistingDocuments) {
      const existingUrls = await loadExistingUrls(container);

      writeOptions = {
        ...writeOptions,
        findMatchingByAlternateKey: (record) =>
          existingUrls.has(record.informationUrl),
        mergeExisting: mergeWorkshop,
      };
    }
  } catch (error) {
    report.failures.push({
      stage: "connect",
      reason: describeCosmosError(error, containerName).message,
    });
    report.failed = report.failures.length;
    return report;
  }

  const writeResult = await upsertRecords(report.records, container, writeOptions);

  report.inserted = writeResult.inserted;
  report.updated = writeResult.updated;
  report.unchanged = writeResult.unchanged;
  report.matchedExisting = writeResult.matchedExisting;
  report.skipped =
    report.duplicatesRemoved + report.unchanged + report.matchedExisting;
  report.failures.push(...writeResult.failures);
  report.failed = report.failures.length;

  return report;
}

export const SAIT_DATASETS = ["programs", "workshops"];

export async function runSaitIngestion({
  datasets = SAIT_DATASETS,
  dryRun = false,
  limit = Infinity,
  fetchImpl = globalThis.fetch,
  getContainer,
  now = () => new Date(),
} = {}) {
  const reports = [];

  if (datasets.includes("workshops")) {
    reports.push(
      await runDataset({
        name: "workshops",
        containerName: SAIT_WORKSHOPS_CONTAINER,
        collect: async () => {
          const { discovered, workshops, failures } =
            await collectSaitWorkshops({ fetchImpl, now, limit });

          return { discovered, records: workshops, failures };
        },
        validate: validateSaitWorkshop,
        deduplicate: deduplicateSaitWorkshops,
        getContainer,
        usesExistingDocuments: true,
        dryRun,
        now,
      })
    );
  }

  if (datasets.includes("programs")) {
    reports.push(
      await runDataset({
        name: "programs",
        containerName: SAIT_PROGRAMS_CONTAINER,
        collect: async () => {
          const { discovered, programs, failures } =
            await collectSaitPrograms({ fetchImpl, now, limit });

          return { discovered, records: programs, failures };
        },
        validate: validateSaitProgram,
        deduplicate: deduplicateSaitPrograms,
        getContainer,
        dryRun,
        now,
      })
    );
  }

  return reports;
}
