import crypto from "node:crypto";

import {
  fetchOfficialPage,
} from "./saitProgramScraper.js";
import {
  findSaitCategory,
} from "./saitProgramNormalization.js";

// The team's existing Cosmos container; its documents must keep their current schema.
export const SAIT_WORKSHOPS_CONTAINER = "workshops";
export const SAIT_DIGITAL_YOUTH_INDEX_URL =
  "https://www.sait.ca/youth-programs/digital-youth/index";
export const SAIT_YOUTH_SITEMAP_URL =
  "https://www.sait.ca/sitemap/index/sitemap-syo.xml";
export const SAIT_YOUTH_SEARCH_SCRIPT_URL =
  "https://www.sait.ca/assets/app/sait/js/search.js";
export const SAIT_YOUTH_REGISTRATION_URL =
  "https://saitdigitalyouth.campbrainregistration.com/";

const YOUTH_PROGRAMS_PATH = "/youth-programs/";

const NON_WORKSHOP_PATHS = new Set([
  "/youth-programs/digital-youth/index",
  "/youth-programs/digital-youth/registration-and-delivery",
]);

const EDUCATOR_ONLY_PATHS = new Set([
  "/youth-programs/digital-youth/professional-development-for-teachers",
]);

const WORKSHOP_FIELDS = new Set([
  "id",
  "audience",
  "availabilityStatus",
  "image",
  "programArea",
  "endDate",
  "description",
  "title",
  "informationUrl",
  "importedFromExcel",
  "capacity",
  "learningMode",
  "grade",
  "minAge",
  "maxAge",
  "minGrade",
  "maxGrade",
  "location",
  "time",
  "category",
  "xpReward",
  "registrationUrl",
  "startDate",
  "status",
  "createdAt",
  "updatedAt",
]);

// Same ID convention as src/app/api/admin/workshops/import/route.js.
export function createWorkshopId(title, programArea) {
  const normalizedText = `${programArea}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const shortHash = crypto
    .createHash("sha256")
    .update(`${programArea}-${title}`)
    .digest("hex")
    .slice(0, 8);

  return `${normalizedText}-${shortHash}`;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value) {
  return decodeHtmlEntities(
    String(value || "")
      .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function getTagAttributes(tag) {
  const attributes = {};
  const attributePattern =
    /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

  for (const match of tag.matchAll(attributePattern)) {
    attributes[match[1].toLowerCase()] =
      match[2] ?? match[3] ?? match[4] ?? "";
  }

  return attributes;
}

function getMetaContent(html, attribute, expectedValue) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = getTagAttributes(match[0]);

    if (
      (attributes[attribute] || "").toLowerCase() ===
      expectedValue.toLowerCase()
    ) {
      return cleanText(attributes.content || "");
    }
  }

  return "";
}

function getMainText(html) {
  const main =
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ||
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
    html;
  const content = main.replace(
    /<(header|nav|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi,
    " "
  );
  const blocks = [...content.matchAll(
    /<(p|li|dt|dd|h[2-6])\b[^>]*>([\s\S]*?)<\/\1>/gi
  )]
    .map((match) => cleanText(match[2]))
    .filter(Boolean);

  return blocks.length > 0 ? blocks.join("\n") : cleanText(content);
}

function extractLabeledValue(text, labels) {
  for (const label of labels) {
    const match = text.match(
      new RegExp(
        `(?:^|\\n)\\s*${label}\\b\\s*:?\\s+([^\\n]{1,120})`,
        "i"
      )
    );

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function extractOfficialImage(html, informationUrl) {
  const image = getMetaContent(html, "property", "og:image");

  if (!image) {
    return null;
  }

  try {
    const imageUrl = new URL(image, informationUrl);

    return imageUrl.protocol === "https:" &&
      (imageUrl.hostname === "sait.ca" ||
        imageUrl.hostname.endsWith(".sait.ca"))
      ? imageUrl.toString()
      : null;
  } catch {
    return null;
  }
}

function extractRegistrationUrl(
  html,
  informationUrl,
  fallbackUrl = SAIT_YOUTH_REGISTRATION_URL
) {
  for (const match of html.matchAll(
    /<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi
  )) {
    const href = match[1] || match[2] || match[3] || "";

    try {
      const url = new URL(decodeHtmlEntities(href), informationUrl);

      if (
        url.protocol === "https:" &&
        /register|registration|campbrain/i.test(url.href)
      ) {
        return url.toString();
      }
    } catch {
      continue;
    }
  }

  return fallbackUrl;
}

function isOfficialSaitUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "sait.ca" || url.hostname.endsWith(".sait.ca"))
    );
  } catch {
    return false;
  }
}

export function extractSaitWorkshopLinks(
  html,
  baseUrl = SAIT_DIGITAL_YOUTH_INDEX_URL
) {
  const urls = new Set();

  for (const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    let url;

    try {
      url = new URL(decodeHtmlEntities(match[1]), baseUrl);
    } catch {
      continue;
    }

    if (
      !isOfficialSaitUrl(url.href) ||
      !url.pathname.startsWith(YOUTH_PROGRAMS_PATH)
    ) {
      continue;
    }

    if (!NON_WORKSHOP_PATHS.has(url.pathname.replace(/\/$/, ""))) {
      urls.add(`${url.origin}${url.pathname}`);
    }
  }

  return [...urls].sort();
}

function extractGradeBounds(text) {
  const matches = [
    /\bgrades?\s*(\d{1,2})\s*(?:-|–|—|to|through|and|or|&|,)\s*(\d{1,2})\b/i,
    /\bgrade\s*(\d{1,2})\s*(?:or|and|&|,)\s*(\d{1,2})\b/i,
    /\bgrade\s*(\d{1,2})\b/i,
  ];

  for (const pattern of matches) {
    const match = text.match(pattern);

    if (match) {
      const minimum = Number(match[1]);
      const maximum = Number(match[2] || match[1]);

      return {
        minGrade: Math.min(minimum, maximum),
        maxGrade: Math.max(minimum, maximum),
      };
    }
  }

  return null;
}

function extractAgeBounds(text) {
  const matches = [
    /\bages?\s*(\d{1,2})\s*(?:-|–|—|to|through)\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:-|–|—|to|through)\s*(\d{1,2})\s*(?:years?\s+old|year-olds?)\b/i,
    /\bages?\s*(\d{1,2})\s*(?:\+|and\s+up|or\s+older)\b/i,
  ];

  for (const pattern of matches) {
    const match = text.match(pattern);

    if (match) {
      return {
        minAge: Number(match[1]),
        maxAge: match[2] ? Number(match[2]) : null,
      };
    }
  }

  return null;
}

function gradeBoundsFromUrl(informationUrl) {
  const match = new URL(informationUrl).pathname.match(
    /\/grades?-(\d{1,2})(?:-(\d{1,2}))?(?:\/|$)/i
  );

  if (!match) {
    return null;
  }

  return {
    minGrade: Number(match[1]),
    maxGrade: Number(match[2] || match[1]),
  };
}

function formatGradeBounds(bounds) {
  if (!bounds) {
    return null;
  }

  return bounds.minGrade === bounds.maxGrade
    ? `Grade ${bounds.minGrade}`
    : `Grades ${bounds.minGrade} - ${bounds.maxGrade}`;
}

function getProgramArea(informationUrl) {
  const pathname = new URL(informationUrl).pathname;

  if (pathname.includes("/digital-youth/")) {
    return "Digital Youth";
  }

  if (pathname.includes("/summer-camps/")) {
    return "Summer Camps";
  }

  if (pathname.includes("/dual-credit-programs/")) {
    return "Dual Credit";
  }

  return "Youth Programs";
}

export function extractSaitWorkshop(
  html,
  informationUrl,
  now = new Date(),
  {
    defaultGrade = null,
    programArea = getProgramArea(informationUrl),
  } = {}
) {
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const title =
    cleanText(heading?.[1]) ||
    getMetaContent(html, "property", "og:title") ||
    cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const mainText = getMainText(html);
  const fallbackDescription = mainText
    .split("\n")
    .filter((line) => line.trim() !== title)
    .join(" ")
    .trim();
  const description =
    getMetaContent(html, "name", "description") ||
    getMetaContent(html, "property", "og:description") ||
    fallbackDescription;
  const sourceText = `${description}\n${mainText}`;

  if (!title) {
    throw new Error(`No workshop title was found at ${informationUrl}.`);
  }

  if (!description) {
    throw new Error(
      `No workshop description or page text was found at ${informationUrl}.`
    );
  }

  const timestamp =
    typeof now === "function" ? now().toISOString() : now.toISOString();

  const labeledMode = extractLabeledValue(mainText, [
    "learning mode",
    "delivery mode",
    "format",
  ]);
  const explicitModeText =
    labeledMode ||
    sourceText.match(
      /\b(?:held|delivered|offered|conducted|available)\s+(?:online|virtually|in[\s-]?person|on[\s-]?campus)\b|\b(?:online|virtual|in[\s-]?person|on[\s-]?campus)\s+(?:workshop|program|session|delivery|format)\b/i
    )?.[0] ||
    "";
  const modeText = explicitModeText.toLowerCase();
  const mentionsOnline =
    /\b(online|virtual|remote)\b/.test(modeText);
  const mentionsInPerson =
    /\b(in[\s-]?person|on[\s-]?campus|classroom)\b/.test(modeText);
  const learningMode =
    mentionsOnline && mentionsInPerson
      ? "hybrid"
      : mentionsOnline
        ? "online"
        : mentionsInPerson
          ? "in-person"
          : null;

  const location = extractLabeledValue(mainText, ["location", "where"]);

  const date = extractLabeledValue(mainText, ["date", "dates"]);
  const startDate =
    extractLabeledValue(mainText, ["start date"]) || date;
  const endDate =
    extractLabeledValue(mainText, ["end date"]) || null;

  const gradeBounds =
    extractGradeBounds(sourceText) ||
    gradeBoundsFromUrl(informationUrl) ||
    extractGradeBounds(defaultGrade || "");
  const ageBounds = extractAgeBounds(sourceText);
  const normalizedGrade = formatGradeBounds(gradeBounds) ||
    defaultGrade ||
    null;
  const isEducatorOnly =
    EDUCATOR_ONLY_PATHS.has(new URL(informationUrl).pathname) ||
    (/\b(?:teachers?|educators?)\b/i.test(sourceText) &&
      !/\b(?:students?|youth)\b/i.test(sourceText));

  return {
    id: createWorkshopId(title, programArea),
    audience: isEducatorOnly ? "educators" : "students",
    availabilityStatus: "unknown",
    programArea,
    image: extractOfficialImage(html, informationUrl),
    endDate,
    description,
    title,
    informationUrl,
    importedFromExcel: false,
    capacity: null,
    learningMode,
    grade: normalizedGrade,
    minAge: ageBounds?.minAge ?? null,
    maxAge: ageBounds?.maxAge ?? null,
    minGrade: gradeBounds?.minGrade ?? null,
    maxGrade: gradeBounds?.maxGrade ?? null,
    location,
    time:
      extractLabeledValue(mainText, ["time", "schedule"]) || "",
    category: findSaitCategory(`${programArea} ${title} ${sourceText}`),
    xpReward: 100,
    registrationUrl: extractRegistrationUrl(
      html,
      informationUrl,
      programArea === "Digital Youth"
        ? SAIT_YOUTH_REGISTRATION_URL
        : informationUrl
    ),
    startDate,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function validateSaitWorkshop(workshop) {
  const errors = [];

  if (!workshop || typeof workshop !== "object" || Array.isArray(workshop)) {
    return {
      valid: false,
      errors: ["A SAIT workshop record must be an object."],
    };
  }

  for (const field of Object.keys(workshop)) {
    if (!WORKSHOP_FIELDS.has(field)) {
      errors.push(`Unexpected field: ${field}.`);
    }
  }

  for (const field of [
    "id",
    "title",
    "description",
    "programArea",
    "category",
    "informationUrl",
    "registrationUrl",
    "status",
    "createdAt",
    "updatedAt",
  ]) {
    if (typeof workshop[field] !== "string" || !workshop[field].trim()) {
      errors.push(`${field} must be a non-empty string.`);
    }
  }

  if (!["students", "educators"].includes(workshop.audience)) {
    errors.push("audience must be students or educators.");
  }

  if (!["open", "closed", "unknown"].includes(workshop.availabilityStatus)) {
    errors.push("availabilityStatus must be open, closed, or unknown.");
  }

  if (workshop.grade !== null && typeof workshop.grade !== "string") {
    errors.push("grade must be a string or null.");
  }

  for (const field of ["minAge", "maxAge", "minGrade", "maxGrade"]) {
    if (
      workshop[field] !== null &&
      (!Number.isInteger(workshop[field]) || workshop[field] < 0)
    ) {
      errors.push(`${field} must be a non-negative integer or null.`);
    }
  }

  if (
    (workshop.minAge !== null &&
      workshop.maxAge !== null &&
      workshop.minAge > workshop.maxAge) ||
    (workshop.minGrade !== null &&
      workshop.maxGrade !== null &&
      workshop.minGrade > workshop.maxGrade)
  ) {
    errors.push("Eligibility ranges must have a minimum no greater than the maximum.");
  }

  if (
    typeof workshop.informationUrl === "string" &&
    !isOfficialSaitUrl(workshop.informationUrl)
  ) {
    errors.push("informationUrl must use the official sait.ca domain.");
  }

  if (
    workshop.image !== null &&
    workshop.image !== undefined &&
    (
      typeof workshop.image !== "string" ||
      !isOfficialSaitUrl(workshop.image)
    )
  ) {
    errors.push("image must be an official SAIT https URL or null.");
  }

  if (
    typeof workshop.registrationUrl === "string" &&
    !workshop.registrationUrl.startsWith("https://")
  ) {
    errors.push("registrationUrl must be an https URL.");
  }

  if (
    workshop.learningMode !== null &&
    !["in-person", "online", "hybrid"].includes(workshop.learningMode)
  ) {
    errors.push("learningMode must be in-person, online, hybrid, or null.");
  }

  if (
    workshop.location !== null &&
    (
      typeof workshop.location !== "string" ||
      !workshop.location.trim()
    )
  ) {
    errors.push("location must be a string or null.");
  }

  if (!["active", "inactive"].includes(workshop.status)) {
    errors.push("status must be active or inactive.");
  }

  if (!Number.isFinite(workshop.xpReward) || workshop.xpReward < 0) {
    errors.push("xpReward must be a non-negative number.");
  }

  if (typeof workshop.importedFromExcel !== "boolean") {
    errors.push("importedFromExcel must be a boolean.");
  }

  for (const field of ["startDate", "endDate", "capacity"]) {
    if (workshop[field] === undefined) {
      errors.push(`${field} must be present (null when unknown).`);
    }
  }

  for (const field of ["createdAt", "updatedAt"]) {
    if (
      typeof workshop[field] === "string" &&
      Number.isNaN(Date.parse(workshop[field]))
    ) {
      errors.push(`${field} must be a valid timestamp.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function deduplicateSaitWorkshops(workshops) {
  const workshopsById = new Map();

  for (const workshop of workshops) {
    const current = workshopsById.get(workshop.id);

    if (
      !current ||
      workshop.description.length > current.description.length ||
      (workshop.description.length === current.description.length &&
        workshop.informationUrl.localeCompare(current.informationUrl) < 0)
    ) {
      workshopsById.set(workshop.id, workshop);
    }
  }

  return [...workshopsById.values()].sort((first, second) =>
    first.id.localeCompare(second.id)
  );
}

export function extractSaitYouthSitemapUrls(
  sitemapXml,
  sitemapUrl = SAIT_YOUTH_SITEMAP_URL
) {
  const urls = new Set();

  for (const match of sitemapXml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
    try {
      const url = new URL(decodeHtmlEntities(match[1]), sitemapUrl);

      if (
        isOfficialSaitUrl(url.href) &&
        url.pathname.startsWith(YOUTH_PROGRAMS_PATH)
      ) {
        urls.add(`${url.origin}${url.pathname}`);
      }
    } catch {
      continue;
    }
  }

  return [...urls].sort();
}

function isWorkshopOfferingUrl(informationUrl) {
  const pathname = new URL(informationUrl).pathname.replace(/\/$/, "");

  if (NON_WORKSHOP_PATHS.has(pathname)) {
    return false;
  }

  if (pathname.startsWith("/youth-programs/digital-youth/")) {
    return !pathname.endsWith("/index");
  }

  if (
    pathname.includes("/summer-camps/programs/camps/") ||
    /\/dual-credit-programs\/(?:programs|courses)\//.test(pathname)
  ) {
    return true;
  }

  return new Set([
    "/youth-programs/evening-youth-programs",
    "/youth-programs/exploring-skilled-trades",
    "/youth-programs/indigenous-youth",
    "/youth-programs/youth-engagement-events",
  ]).has(pathname);
}

async function fetchSaitSummerCampCatalog(fetchImpl) {
  const searchScript = await fetchOfficialPage(
    SAIT_YOUTH_SEARCH_SCRIPT_URL,
    fetchImpl
  );
  const config = searchScript.match(
    /appId:([$\w]+),apiKey:([$\w]+),indexName:"syo"/
  );

  if (!config) {
    throw new Error("Could not read the official SAIT youth search configuration.");
  }

  const readStringConstant = (name) =>
    searchScript.match(
      new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`)
    )?.[1];
  const applicationId = readStringConstant(config[1]);
  const apiKey = readStringConstant(config[2]);

  if (!applicationId || !apiKey) {
    throw new Error("The official SAIT youth search credentials were not found.");
  }

  const headers = {
    "content-type": "application/json",
    "x-algolia-application-id": applicationId,
    "x-algolia-api-key": apiKey,
  };
  const endpoint =
    `https://${applicationId.toLowerCase()}-dsn.algolia.net/1/indexes/syo/query`;
  const allHits = [];
  let page = 0;
  let pageCount = 1;

  while (page < pageCount) {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: "",
        filters: "type:CampDetail",
        hitsPerPage: 1000,
        page,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `The SAIT summer camp catalog request failed (${response.status} ${response.statusText}).`
      );
    }

    const result = await response.json();

    if (
      !Array.isArray(result.hits) ||
      !Number.isInteger(result.nbPages) ||
      result.nbPages < 0
    ) {
      throw new Error("The SAIT summer camp catalog returned an invalid result.");
    }

    allHits.push(...result.hits);
    pageCount = result.nbPages;
    page += 1;
  }

  return allHits.filter(
    (hit) =>
      hit.type === "CampDetail" &&
      typeof hit.url === "string" &&
      isOfficialSaitUrl(hit.url) &&
      new URL(hit.url).pathname.includes("/summer-camps/programs/camps/")
  );
}

function applyCampCatalogData(workshop, campRecord) {
  const catalogGrade =
    typeof campRecord.recordObj?.campGrade === "string"
      ? campRecord.recordObj.campGrade.trim()
      : "";
  const gradeBounds = extractGradeBounds(`Grades ${catalogGrade}`);

  if (gradeBounds) {
    workshop.grade = formatGradeBounds(gradeBounds);
    workshop.minGrade = gradeBounds.minGrade;
    workshop.maxGrade = gradeBounds.maxGrade;
  }

  const campDates = campRecord.recordObj?.campDates;

  if (Array.isArray(campDates) && campDates.length > 0) {
    const statuses = campDates.map((date) =>
      String(date.status || "").toLowerCase()
    );

    if (
      statuses.every((status) =>
        ["closed", "full", "cancelled", "sold out", "waitlist"].includes(status)
      )
    ) {
      workshop.availabilityStatus = "closed";
    } else if (
      statuses.some((status) =>
        ["open", "available", "active"].includes(status)
      )
    ) {
      workshop.availabilityStatus = "open";
    }
  }
}

async function getYouthProgramDefaultGrades(sitemapUrls, fetchImpl) {
  const defaultGrades = {};
  const sources = [
    {
      programArea: "Digital Youth",
      path: "/youth-programs/digital-youth",
      url: SAIT_DIGITAL_YOUTH_INDEX_URL,
    },
    {
      programArea: "Dual Credit",
      path: "/youth-programs/dual-credit-programs",
      url: "https://www.sait.ca/youth-programs/dual-credit-programs/index",
    },
  ];
  const presentSources = sources.filter(({ path }) =>
    sitemapUrls.some((url) => new URL(url).pathname.startsWith(`${path}/`))
  );

  const results = await Promise.all(
    presentSources.map(async ({ programArea, url }) => {
      const html = await fetchOfficialPage(url, fetchImpl);
      return {
        programArea,
        text: `${getMetaContent(html, "name", "description")}\n${getMainText(html)}`,
      };
    })
  );

  for (const { programArea, text } of results) {
    defaultGrades[programArea] = formatGradeBounds(extractGradeBounds(text));
  }

  return defaultGrades;
}

export async function collectSaitWorkshops({
  fetchImpl = globalThis.fetch,
  sitemapUrl = SAIT_YOUTH_SITEMAP_URL,
  now = () => new Date(),
  limit = Infinity,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required to scrape SAIT.");
  }

  const sitemapXml = await fetchOfficialPage(sitemapUrl, fetchImpl);
  const sitemapUrls = extractSaitYouthSitemapUrls(sitemapXml, sitemapUrl);
  const campRecords = sitemapUrls.some((url) =>
    new URL(url).pathname.includes("/summer-camps/programs/camps/")
  )
    ? await fetchSaitSummerCampCatalog(fetchImpl)
    : [];
  const campRecordsByUrl = new Map(
    campRecords.map((record) => [
      new URL(record.url).toString().replace(/\/$/, ""),
      record,
    ])
  );
  const workshopUrls = [...new Set([
    ...sitemapUrls.filter(isWorkshopOfferingUrl),
    ...campRecordsByUrl.keys(),
  ])].sort();

  if (workshopUrls.length === 0) {
    throw new Error(
      `No SAIT Youth Programs workshop pages were found from ${sitemapUrl}.`
    );
  }

  const workshops = [];
  const failures = [];
  const defaultGrades = await getYouthProgramDefaultGrades(
    sitemapUrls,
    fetchImpl
  );

  const urlsToFetch = workshopUrls.slice(0, limit);
  const fetchedRecords = await Promise.all(
    urlsToFetch.map(async (informationUrl) => {
      try {
        const html = await fetchOfficialPage(informationUrl, fetchImpl);
        const programArea = getProgramArea(informationUrl);
        const record = extractSaitWorkshop(html, informationUrl, now, {
          defaultGrade: defaultGrades[programArea] || null,
          programArea,
        });
        const campRecord = campRecordsByUrl.get(
          informationUrl.replace(/\/$/, "")
        );

        if (campRecord) {
          applyCampCatalogData(record, campRecord);
        }

        return record;
      } catch (error) {
        failures.push({ url: informationUrl, error });
        return null;
      }
    })
  );

  workshops.push(...fetchedRecords.filter(Boolean));

  return { discovered: workshopUrls.length, workshops, failures };
}
