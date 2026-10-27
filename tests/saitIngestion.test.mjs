import assert from "node:assert/strict";
import test from "node:test";

import {
  runSaitIngestion,
  upsertRecords,
} from "../src/services/saitIngestion.js";
import {
  collectSaitWorkshops,
  extractSaitWorkshop,
  extractSaitWorkshopLinks,
  extractSaitYouthSitemapUrls,
  validateSaitWorkshop,
} from "../src/services/saitWorkshopIngestion.js";

const NOW = () => new Date("2026-10-11T00:00:00.000Z");

const INDEX_HTML = `
  <a href="/youth-programs/digital-youth/cybersecurity">Cybersecurity</a>
  <a href="/youth-programs/digital-youth/cybersecurity">Learn more</a>
  <a href="/youth-programs/digital-youth/art-of-the-possible">Art of the Possible Workshops</a>
  <a href="/youth-programs/digital-youth/skills-workshops">Skills</a>
  <a href="/youth-programs/digital-youth/professional-development-for-teachers">Teacher Workshops</a>
  <a href="/youth-programs/digital-youth/index">Overview</a>
  <a href="/youth-programs/digital-youth/registration-and-delivery">Registration</a>
`;

const SINGLE_WORKSHOP_INDEX_HTML =
  '<a href="/youth-programs/digital-youth/cybersecurity">Cybersecurity</a>';

const SINGLE_WORKSHOP_SITEMAP = `
  <urlset>
    <url><loc>https://www.sait.ca/youth-programs/digital-youth/cybersecurity</loc></url>
  </urlset>
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
test("discovers workshop topics and offering pages while excluding navigation pages", () => {
  const urls = extractSaitWorkshopLinks(INDEX_HTML);

  assert.deepEqual(urls, [
    "https://www.sait.ca/youth-programs/digital-youth/art-of-the-possible",
    "https://www.sait.ca/youth-programs/digital-youth/cybersecurity",
    "https://www.sait.ca/youth-programs/digital-youth/professional-development-for-teachers",
    "https://www.sait.ca/youth-programs/digital-youth/skills-workshops",
  ]);

  const record = workshop();

  assert.match(record.id, /^digital-youth-cybersecurity-[0-9a-f]{8}$/);
  assert.equal(record.grade, "Grades 6 - 12");
  assert.equal(record.xpReward, 100);
  assert.equal(record.startDate, null);
  assert.equal(record.learningMode, null);
  assert.equal(record.location, null);
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

test("uses only official SAIT youth pages from its sitemap", () => {
  const urls = extractSaitYouthSitemapUrls(`
    <urlset>
      <url><loc>https://www.sait.ca/youth-programs/digital-youth/cybersecurity</loc></url>
      <url><loc>https://www.sait.ca/programs-and-courses</loc></url>
      <url><loc>https://example.com/youth-programs/workshop</loc></url>
    </urlset>
  `);

  assert.deepEqual(urls, [
    "https://www.sait.ca/youth-programs/digital-youth/cybersecurity",
  ]);
});

test("extracts available official workshop details without inventing unknown values", () => {
  const record = extractSaitWorkshop(
    `<html>
      <head>
        <meta content="/images/cybersecurity.jpg" property="og:image">
        <meta content="Official workshop description." name="description">
      </head>
      <body><main>
        <h1>Cybersecurity</h1>
        <p>Designed for students in grades 7-9.</p>
        <p>Learning mode: Online</p>
        <p>Location: Online</p>
        <p>Start date: June 4, 2027</p>
        <p>End date: June 5, 2027</p>
        <p>Time: 9 a.m. - 3 p.m.</p>
        <a href="https://saitdigitalyouth.campbrainregistration.com/class">Register</a>
      </main></body>
    </html>`,
    "https://www.sait.ca/youth-programs/digital-youth/cybersecurity",
    NOW
  );

  assert.equal(record.description, "Official workshop description.");
  assert.equal(record.grade, "Grades 7 - 9");
  assert.equal(record.learningMode, "online");
  assert.equal(record.location, "Online");
  assert.equal(record.startDate, "June 4, 2027");
  assert.equal(record.endDate, "June 5, 2027");
  assert.equal(record.time, "9 a.m. - 3 p.m.");
  assert.equal(
    record.image,
    "https://www.sait.ca/images/cybersecurity.jpg"
  );
  assert.equal(
    record.registrationUrl,
    "https://saitdigitalyouth.campbrainregistration.com/class"
  );
  assert.equal(validateSaitWorkshop(record).valid, true);
});

test("extracts age and grade bounds for student eligibility", () => {
  const record = extractSaitWorkshop(
    `<main>
      <h1>Junior Coding Camp</h1>
      <p>Designed for students ages 8 to 12 and grades 3 through 6.</p>
    </main>`,
    "https://www.sait.ca/youth-programs/summer-camps/programs/camps/junior-coding",
    NOW
  );

  assert.equal(record.programArea, "Summer Camps");
  assert.equal(record.grade, "Grades 3 - 6");
  assert.equal(record.minAge, 8);
  assert.equal(record.maxAge, 12);
  assert.equal(record.minGrade, 3);
  assert.equal(record.maxGrade, 6);
  assert.equal(record.audience, "students");
  assert.equal(validateSaitWorkshop(record).valid, true);
});

test("keeps closed camps visible with their published grade range", async () => {
  const campUrl =
    "https://www.sait.ca/youth-programs/summer-camps/programs/camps/grades-4-6/junior-coding";
  const campHtml = `
    <html>
      <head>
        <meta content="A coding camp for youth." name="description">
      </head>
      <main>
        <h1>Junior Coding Camp</h1>
        <p>Grade Level: Grades 4 - 6</p>
      </main>
    </html>
  `;
  const fetchImpl = async (url) => {
    const target = String(url);

    if (target.includes("sitemap-syo.xml")) {
      return {
        ok: true,
        text: async () => `<urlset><url><loc>${campUrl}</loc></url></urlset>`,
      };
    }

    if (target.endsWith("/search.js")) {
      return {
        ok: true,
        text: async () =>
          'const appId="APP123";const apiKey="PUBLIC";({appId:appId,apiKey:apiKey,indexName:"syo"})',
      };
    }

    if (target.includes("algolia.net")) {
      return {
        ok: true,
        json: async () => ({
          nbPages: 1,
          hits: [
            {
              type: "CampDetail",
              url: campUrl,
              recordObj: {
                campGrade: "4 - 6",
                campDates: [{ status: "closed" }],
              },
            },
          ],
        }),
      };
    }

    return {
      ok: true,
      text: async () => campHtml,
    };
  };

  const result = await collectSaitWorkshops({
    fetchImpl,
    now: NOW,
  });

  assert.equal(result.discovered, 1);
  assert.equal(result.failures.length, 0);
  assert.equal(result.workshops[0].title, "Junior Coding Camp");
  assert.equal(result.workshops[0].grade, "Grades 4 - 6");
  assert.equal(result.workshops[0].minGrade, 4);
  assert.equal(result.workshops[0].maxGrade, 6);
  assert.equal(result.workshops[0].availabilityStatus, "closed");
  assert.equal(result.workshops[0].status, "active");
  assert.equal(validateSaitWorkshop(result.workshops[0]).valid, true);
});

test("rejects workshop pages without official descriptions or page text", () => {
  assert.throws(
    () =>
      extractSaitWorkshop(
        "<html><main><h1>Cybersecurity</h1></main></html>",
        "https://www.sait.ca/youth-programs/digital-youth/cybersecurity",
        NOW
      ),
    /No workshop description or page text/
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
  const target = String(url);
  const body = target.includes("sitemap-syo.xml")
    ? SINGLE_WORKSHOP_SITEMAP
    : target.endsWith("/digital-youth/index")
      ? SINGLE_WORKSHOP_INDEX_HTML
      : target.endsWith("/cybersecurity")
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

  test("does not write a partial workshop import when a page fetch fails", async () => {
    const sitemap = `
      <urlset>
        <url><loc>https://www.sait.ca/youth-programs/digital-youth/cybersecurity</loc></url>
        <url><loc>https://www.sait.ca/youth-programs/digital-youth/coding</loc></url>
      </urlset>
    `;
    const reports = await runSaitIngestion({
      datasets: ["workshops"],
      fetchImpl: async (url) => {
        if (String(url).includes("sitemap-syo.xml")) {
          return {
            ok: true,
            text: async () => sitemap,
          };
        }

        if (String(url).endsWith("/digital-youth/index")) {
          return {
            ok: true,
            text: async () => SINGLE_WORKSHOP_INDEX_HTML,
          };
        }

        if (String(url).endsWith("/cybersecurity")) {
          return {
            ok: true,
            text: async () =>
              `<main><h1>Cybersecurity</h1><p>Official program description.</p></main>`,
          };
        }

        return {
          ok: false,
          status: 503,
          statusText: "Unavailable",
        };
      },
      getContainer: () => {
        throw new Error("A partial scrape must not contact Cosmos.");
      },
      now: NOW,
    });

    assert.equal(reports[0].discovered, 2);
    assert.equal(reports[0].validated, 1);
    assert.equal(reports[0].failed, 1);
    assert.equal(reports[0].skipped, 1);
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

test("re-running refreshes scraped fields and preserves application-owned fields", async () => {
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
  assert.equal(container.store.get(current.id).learningMode, null);
  assert.equal(container.store.get(current.id).location, null);
});
