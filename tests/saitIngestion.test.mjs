import assert from "node:assert/strict";
import test from "node:test";

import {
  runSaitIngestion,
  upsertRecords,
} from "../src/services/saitIngestion.js";
import {
  extractSaitWorkshop,
  extractSaitWorkshopLinks,
  validateSaitWorkshop,
} from "../src/services/saitWorkshopIngestion.js";

const NOW = () => new Date("2026-10-11T00:00:00.000Z");

const INDEX_HTML = `
  <a href="/youth-programs/digital-youth/cybersecurity">Cybersecurity</a>
  <a href="/youth-programs/digital-youth/cybersecurity">Learn more</a>
  <a href="/youth-programs/digital-youth/skills-workshops">Skills</a>
  <a href="/youth-programs/digital-youth/index">Overview</a>
`;

const TOPIC_HTML = `
  <meta content="Designed for students in grades 6&#8211;12." name="description">
  <h1 class="page-heading"> Cybersecurity </h1>
`;

function cosmosLike(initial = {}, { failWith, upsertError } = {}) {
  const store = new Map(Object.entries(initial));

  return {
    id: "workshops",
    store,
    read: async () => ({ resource: { partitionKey: { paths: ["/id"] } } }),
    item: (id) => ({
      read: async () => {
        if (failWith) throw failWith;
        return { resource: store.get(id) };
      },
    }),
    items: {
      query: () => ({
        fetchAll: async () => ({ resources: [...store.values()] }),
      }),
      upsert: async (record) => {
        if (upsertError) throw upsertError;
        store.set(record.id, record);
      },
    },
  };
}

function workshop(overrides = {}) {
  return {
    ...extractSaitWorkshop(
      TOPIC_HTML,
      "https://www.sait.ca/youth-programs/digital-youth/cybersecurity",
      NOW
    ),
    ...overrides,
  };
}
test("discovers only workshop topic pages and extracts a valid record", () => {
  const urls = extractSaitWorkshopLinks(INDEX_HTML);

  assert.deepEqual(urls, [
    "https://www.sait.ca/youth-programs/digital-youth/cybersecurity",
  ]);

  const record = workshop();

  assert.match(record.id, /^digital-youth-cybersecurity-[0-9a-f]{8}$/);
  assert.equal(record.grade, "Grades 6 - 12");
  assert.equal(record.xpReward, 100);
  assert.equal(record.startDate, null);
  assert.equal(record.importedFromExcel, false);
  assert.equal("source" in record, false);
  assert.equal(record.category, "Technology");
  assert.equal(validateSaitWorkshop(record).valid, true);
  assert.equal(
    validateSaitWorkshop({ ...record, informationUrl: "https://example.com/" })
      .valid,
    false
  );
});

test("upsertRecords reports inserted, updated and unchanged records", async () => {
  const unchanged = workshop({ id: "same" });
  const changed = workshop({ id: "changed" });
  const fresh = workshop({ id: "fresh" });
  const container = cosmosLike({
    same: { ...unchanged, _etag: "x", updatedAt: "2020-01-01T00:00:00.000Z" },
    changed: { ...changed, description: "old text" },
  });

  const result = await upsertRecords([unchanged, changed, fresh], container, {
    now: NOW,
  });

  assert.equal(result.inserted, 1);
  assert.equal(result.updated, 1);
  assert.equal(result.unchanged, 1);
  assert.deepEqual(result.failures, []);
  assert.equal(container.store.get("changed").description, changed.description);
});

test("upsertRecords aborts on authorization errors and reports every record", async () => {
  const container = cosmosLike(
    {},
    { failWith: Object.assign(new Error("forbidden"), { code: 403 }) }
  );

  const result = await upsertRecords(
    [workshop({ id: "a" }), workshop({ id: "b" })],
    container
  );

  assert.equal(result.inserted, 0);
  assert.equal(result.failures.length, 2);
  assert.match(result.failures[0].reason, /rejected the credentials/);
  assert.match(result.failures[1].reason, /Not attempted/);
});

test("upsertRecords keeps going after a non-fatal write error", async () => {
  const container = cosmosLike(
    {},
    { upsertError: Object.assign(new Error("boom"), { code: 500 }) }
  );

  const result = await upsertRecords(
    [workshop({ id: "a" }), workshop({ id: "b" })],
    container
  );

  assert.equal(result.failures.length, 2);
  assert.doesNotMatch(result.failures[1].reason, /Not attempted/);
});

function fetchStub(url) {
  const body = String(url).includes("/digital-youth/index")
    ? INDEX_HTML
    : String(url).endsWith("/cybersecurity")
      ? TOPIC_HTML
      : null;

  return Promise.resolve(
    body === null
      ? { ok: false, status: 503, statusText: "Unavailable" }
      : { ok: true, text: async () => body }
  );
}

test("dry run never requests a Cosmos container", async () => {
  const reports = await runSaitIngestion({
    datasets: ["workshops"],
    dryRun: true,
    fetchImpl: fetchStub,
    getContainer: () => {
      throw new Error("Cosmos must not be contacted during a dry run.");
    },
    now: NOW,
  });

  assert.equal(reports[0].discovered, 1);
  assert.equal(reports[0].validated, 1);
  assert.equal(reports[0].inserted, 0);
  assert.equal(reports[0].records.length, 1);
  assert.equal(reports[0].failed, 0);
});

test("network failures are reported without writing", async () => {
  const reports = await runSaitIngestion({
    datasets: ["workshops"],
    fetchImpl: () => Promise.reject(new Error("fetch failed")),
    getContainer: () => {
      throw new Error("should not be called");
    },
  });

  assert.equal(reports[0].failed, 1);
  assert.equal(reports[0].failures[0].stage, "discovery");
});

test("a live run writes through the supplied container", async () => {
  const container = cosmosLike();
  const reports = await runSaitIngestion({
    datasets: ["workshops"],
    fetchImpl: fetchStub,
    getContainer: () => container,
    now: NOW,
  });

  assert.equal(reports[0].inserted, 1);
  assert.equal(reports[0].failed, 0);
  assert.equal(container.store.has(workshop().id), true);
});

test("an existing document for the same SAIT page is left untouched", async () => {
  const existing = workshop({
    id: "digital-youth-art-of-the-possible-cybersecurity-1234abcd",
    title: "Art of the Possible: Cybersecurity",
    xpReward: 250,
  });
  const container = cosmosLike({ [existing.id]: existing });
  const reports = await runSaitIngestion({
    datasets: ["workshops"],
    fetchImpl: fetchStub,
    getContainer: () => container,
    now: NOW,
  });

  assert.equal(reports[0].inserted, 0);
  assert.equal(reports[0].matchedExisting, 1);
  assert.equal(container.store.size, 1);
  assert.equal(container.store.get(existing.id).xpReward, 250);
});

test("re-running updates only scraper-owned text on an existing id", async () => {
  const current = workshop({ description: "old", xpReward: 250 });
  const container = cosmosLike({ [current.id]: current });
  const reports = await runSaitIngestion({
    datasets: ["workshops"],
    fetchImpl: fetchStub,
    getContainer: () => container,
    now: NOW,
  });

  assert.equal(reports[0].updated, 1);
  assert.equal(container.store.get(current.id).xpReward, 250);
  assert.notEqual(container.store.get(current.id).description, "old");
});
