import assert from "node:assert/strict";
import test from "node:test";

import {
  createSaitProgramId,
  deduplicateSaitPrograms,
  normalizeSaitProgram,
  validateSaitProgram,
} from "../src/services/saitProgramNormalization.js";
import {
  extractRawSaitProgram,
  extractSaitProgramLinks,
  extractSaitProgramSitemapUrl,
  extractSaitProgramUrlsFromSitemap,
  scrapeSaitPrograms,
} from "../src/services/saitProgramScraper.js";
import {
  PROGRAM_RECOMMENDATION_WEIGHTS,
  recommendSaitPrograms,
} from "../src/services/saitProgramRecommendations.js";
import {
  SAIT_PROGRAMS_CONTAINER,
  upsertSaitPrograms,
} from "../src/services/saitProgramService.js";

const fixedDate = () => new Date("2026-10-07T00:00:00.000Z");

function makeProgram(overrides = {}) {
  return normalizeSaitProgram(
    {
      title: "Software Development Diploma",
      description:
        "Study software development, programming and problem solving.",
      informationUrl:
        "https://www.sait.ca/programs-and-courses/diplomas/software-development",
      sourceText: "This diploma includes programming.",
      ...overrides,
    },
    fixedDate
  );
}

test("creates deterministic program IDs from official titles", () => {
  assert.equal(
    createSaitProgramId("Software Development Diploma"),
    "software-development-diploma"
  );
  assert.equal(
    makeProgram().id,
    makeProgram({ description: "A changed description." }).id
  );
});

test("normalizes an official program and leaves unknown details empty", () => {
  const program = makeProgram();

  assert.equal(program.category, "Technology");
  assert.equal(program.credential, "Diploma");
  assert.deepEqual(program.relatedWorkshopCategories, ["Technology"]);
  assert.ok(program.relatedWorkshopTopics.includes("Coding"));
  assert.ok(program.skills.includes("Programming"));
  assert.equal(program.programArea, null);
  assert.equal(program.learningMode, null);
  assert.equal(program.duration, null);
  assert.deepEqual(program.admissionRequirements, []);
  assert.equal(program.source, "SAIT");
  assert.deepEqual(validateSaitProgram(program), {
    valid: true,
    errors: [],
  });
});

test("does not link unsupported categories to unrelated General workshops", () => {
  const healthProgram = makeProgram({
    title: "Medical Laboratory Assistant",
    description: "Prepare for a career in healthcare.",
    sourceText: "",
  });

  assert.equal(healthProgram.category, "Health");
  assert.deepEqual(healthProgram.relatedWorkshopCategories, []);
});

test("rejects non-official URLs and Cosmos system properties", () => {
  assert.throws(
    () =>
      normalizeSaitProgram(
        {
          title: "Example Diploma",
          informationUrl: "https://example.com/program",
        },
        fixedDate
      ),
    /official sait\.ca domain/
  );

  const invalidRecord = {
    ...makeProgram(),
    _etag: "system-value",
  };
  assert.match(
    validateSaitProgram(invalidRecord).errors.join(" "),
    /Unexpected field: _etag/
  );
});

test("deduplicates by stable ID, preferring the most complete record", () => {
  const shortDescription = makeProgram({
    description: "Software development diploma.",
    sourceText: "",
  });
  const fullDescription = makeProgram();

  assert.deepEqual(
    deduplicateSaitPrograms([shortDescription, fullDescription]),
    [fullDescription]
  );
});

test("upserts by deterministic ID and preserves the original createdAt", async () => {
  const program = makeProgram();
  const upsertedRecords = [];
  const existingCreatedAt = "2026-09-01T12:00:00.000Z";
  const mockContainer = {
    item(id, partitionKey) {
      assert.equal(id, program.id);
      assert.equal(partitionKey, program.id);
      return {
        async read() {
          return {
            resource: {
              id,
              createdAt: existingCreatedAt,
              _etag: "Cosmos-managed",
            },
          };
        },
      };
    },
    items: {
      async upsert(record) {
        upsertedRecords.push(record);
      },
    },
  };

  const savedPrograms = await upsertSaitPrograms([program], {
    container: mockContainer,
    now: fixedDate,
  });

  assert.equal(SAIT_PROGRAMS_CONTAINER, "saitPrograms");
  assert.equal(savedPrograms.length, 1);
  assert.equal(savedPrograms[0].createdAt, existingCreatedAt);
  assert.equal(savedPrograms[0].updatedAt, fixedDate().toISOString());
  assert.equal(upsertedRecords.length, 1);
  assert.equal(upsertedRecords[0].id, program.id);
  assert.equal("_etag" in upsertedRecords[0], false);
});

test("extracts official program links and excludes other hosts", () => {
  const links = extractSaitProgramLinks(`
    <a href="/programs-and-courses/diplomas/software-development">Software</a>
    <a href="https://www.sait.ca/programs-and-courses/certificates/cyber-security">Cyber</a>
    <a href="https://example.com/programs-and-courses/fake">Fake</a>
    <a href="/programs-and-courses">Index</a>
  `);

  assert.deepEqual(links, [
    "https://www.sait.ca/programs-and-courses/certificates/cyber-security",
    "https://www.sait.ca/programs-and-courses/diplomas/software-development",
  ]);
});

test("finds official program pages from SAIT's sitemap", () => {
  const sitemapIndex = `
    <sitemapindex>
      <sitemap><loc>https://www.sait.ca/sitemap/index/sitemap-sait.xml</loc></sitemap>
      <sitemap><loc>https://example.com/sitemap-sait.xml</loc></sitemap>
    </sitemapindex>`;
  const sitemap = `
    <urlset>
      <url><loc>https://www.sait.ca/programs-and-courses/degrees/bachelor-of-business-administration</loc></url>
      <url><loc>https://www.sait.ca/programs-and-courses/information-sessions/on-demand</loc></url>
      <url><loc>https://example.com/programs-and-courses/diplomas/fake</loc></url>
    </urlset>`;

  assert.equal(
    extractSaitProgramSitemapUrl(sitemapIndex),
    "https://www.sait.ca/sitemap/index/sitemap-sait.xml"
  );
  assert.deepEqual(extractSaitProgramUrlsFromSitemap(sitemap), [
    "https://www.sait.ca/programs-and-courses/degrees/bachelor-of-business-administration",
  ]);
});

test("extracts official page title and description", () => {
  const rawProgram = extractRawSaitProgram(
    `<html><head>
      <title>Software Development Diploma | SAIT</title>
      <meta name="description" content="An official program description.">
    </head><body><main><h1>Software Development Diploma</h1>
      <p>Credential: diploma More info on program credentials</p>
      <p>Program length: Two years full-time. Learn more about program length</p>
      <p>Location: In person (Main Campus) or Online</p>
      <p>Faculty: School for Advanced Digital Technology</p>
    </main></body></html>`,
    "https://www.sait.ca/programs-and-courses/diplomas/software-development"
  );

  const program = normalizeSaitProgram(rawProgram, fixedDate);
  assert.equal(program.title, "Software Development Diploma");
  assert.equal(program.description, "An official program description.");
  assert.equal(program.credential, "Diploma");
  assert.equal(program.duration, "Two years full-time.");
  assert.equal(program.learningMode, "hybrid");
  assert.equal(program.location, "Main Campus");
  assert.equal(program.programArea, "School for Advanced Digital Technology");
});

test("marks programs inactive only for an explicit SAIT availability notice", () => {
  const rawProgram = extractRawSaitProgram(
    `<html><head>
      <meta name="description" content="An official program description.">
    </head><body><main><h1>Archived Program</h1>
      <p>This program is no longer offered.</p>
    </main></body></html>`,
    "https://www.sait.ca/programs-and-courses/diplomas/archived-program"
  );

  assert.equal(
    normalizeSaitProgram(rawProgram, fixedDate).status,
    "inactive"
  );
});

test("scrapes listing pages and reports request failures", async () => {
  const responses = new Map([
    [
      "https://www.sait.ca/programs-and-courses",
      `<a href="/programs-and-courses/diplomas/software-development">Software</a>`,
    ],
    [
      "https://www.sait.ca/programs-and-courses/diplomas/software-development",
      `<title>Software Development Diploma | SAIT</title>
       <meta name="description" content="Learn programming.">
       <main><h1>Software Development Diploma</h1></main>`,
    ],
  ]);
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => responses.get(url),
  });

  const programs = await scrapeSaitPrograms({
    fetchImpl,
    now: fixedDate,
  });
  assert.equal(programs.length, 1);
  assert.equal(programs[0].title, "Software Development Diploma");

  await assert.rejects(
    scrapeSaitPrograms({
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        statusText: "Unavailable",
      }),
    }),
    /SAIT page request failed/
  );
});

test("uses the official SAIT sitemap when the listing is client-rendered", async () => {
  const responses = new Map([
    [
      "https://www.sait.ca/programs-and-courses",
      "<html><main><search-index id='hits'></search-index></main></html>",
    ],
    [
      "https://www.sait.ca/sitemap/sitemap-index.xml",
      `<sitemapindex><sitemap>
        <loc>https://www.sait.ca/sitemap/index/sitemap-sait.xml</loc>
      </sitemap></sitemapindex>`,
    ],
    [
      "https://www.sait.ca/sitemap/index/sitemap-sait.xml",
      `<urlset>
        <url><loc>https://www.sait.ca/programs-and-courses/certificates/cyber-security</loc></url>
        <url><loc>https://www.sait.ca/programs-and-courses/information-sessions/on-demand</loc></url>
      </urlset>`,
    ],
    [
      "https://www.sait.ca/programs-and-courses/certificates/cyber-security",
      `<title>Cyber Security | SAIT</title>
       <meta name="description" content="Explore cybersecurity and information security.">
       <main><h1>Cyber Security</h1>
         <p>Credential: certificate More info on program credentials</p>
       </main>`,
    ],
  ]);
  const fetchImpl = async (url) => ({
    ok: responses.has(url),
    status: responses.has(url) ? 200 : 404,
    statusText: responses.has(url) ? "OK" : "Not Found",
    text: async () => responses.get(url),
  });

  const programs = await scrapeSaitPrograms({
    fetchImpl,
    now: fixedDate,
  });

  assert.equal(programs.length, 1);
  assert.equal(programs[0].title, "Cyber Security");
  assert.equal(programs[0].credential, "Certificate");
  assert.equal(programs[0].category, "Technology");
});

test("recommends programs using only supported matching evidence", () => {
  const program = makeProgram();
  const recommendations = recommendSaitPrograms({
    student: {
      interests: ["coding"],
    },
    completedWorkshops: [
      {
        title: "Intro to Coding",
        category: "Technology",
      },
    ],
    programs: [program],
  });

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].score, 100);
  assert.deepEqual(recommendations[0].reasons, [
    "Matches your interest in coding",
    "Connects your coding interest with Programming",
    "Builds on your completed Intro to Coding workshop",
    "Connects with Coding topics from your learning journey",
  ]);

  const noMatch = recommendSaitPrograms({
    student: {
      interests: ["health"],
    },
    completedWorkshops: [],
    programs: [program],
  });
  assert.deepEqual(noMatch, []);
});

test("supports documented, configurable recommendation weights", () => {
  assert.equal(
    Object.values(PROGRAM_RECOMMENDATION_WEIGHTS).reduce(
      (total, weight) => total + weight,
      0
    ),
    100
  );
  assert.throws(
    () =>
      recommendSaitPrograms(
        {
          student: { interests: ["coding"] },
          completedWorkshops: [],
          programs: [makeProgram()],
        },
        {
          weights: {
            ...PROGRAM_RECOMMENDATION_WEIGHTS,
            interestCategory: -1,
          },
        }
      ),
    /non-negative number/
  );
});
