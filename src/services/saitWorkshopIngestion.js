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
export const SAIT_YOUTH_REGISTRATION_URL =
  "https://saitdigitalyouth.campbrainregistration.com/";

const DIGITAL_YOUTH_PATH = "/youth-programs/digital-youth/";

// Digital Youth pages that describe formats, delivery or registration, not a workshop topic.
const NON_WORKSHOP_PAGES = new Set([
  "index",
  "art-of-the-possible",
  "skills-workshops",
  "professional-development-for-teachers",
  "registration-and-delivery",
]);

const WORKSHOP_FIELDS = new Set([
  "id",
  "programArea",
  "endDate",
  "description",
  "title",
  "informationUrl",
  "importedFromExcel",
  "capacity",
  "learningMode",
  "grade",
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
      String.fromCodePoint(parseInt(code, 16))
    )
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
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
      !url.pathname.startsWith(DIGITAL_YOUTH_PATH)
    ) {
      continue;
    }

    const slug = url.pathname.slice(DIGITAL_YOUTH_PATH.length);

    if (slug && !slug.includes("/") && !NON_WORKSHOP_PAGES.has(slug)) {
      urls.add(`${url.origin}${url.pathname}`);
    }
  }

  return [...urls].sort();
}

function extractGrade(text) {
  const range = text.match(/\bgrades?\s+(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\b/i);

  return range ? `Grades ${range[1]} - ${range[2]}` : null;
}

export function extractSaitWorkshop(html, informationUrl, now = new Date()) {
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const title = cleanText(heading?.[1]);
  const metaTag = html
    .match(/<meta\b[^>]*\bname=["']description["'][^>]*>/i)?.[0];
  const description = cleanText(
    metaTag?.match(/\bcontent=["']([^"']*)["']/i)?.[1]
  );

  if (!title) {
    throw new Error(`No workshop title was found at ${informationUrl}.`);
  }

  const timestamp =
    typeof now === "function" ? now().toISOString() : now.toISOString();
  return {
    id: createWorkshopId(title, "Digital Youth"),
    programArea: "Digital Youth",
    endDate: null,
    description,
    title,
    informationUrl,
    importedFromExcel: false,
    capacity: null,
    learningMode: "in-person",
    grade: extractGrade(description),
    location: "SAIT Campus",
    time: "",
    category: findSaitCategory(`Digital Youth ${title} ${description}`),
    xpReward: 100,
    registrationUrl: SAIT_YOUTH_REGISTRATION_URL,
    startDate: null,
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
    "location",
    "status",
    "createdAt",
    "updatedAt",
  ]) {
    if (typeof workshop[field] !== "string" || !workshop[field].trim()) {
      errors.push(`${field} must be a non-empty string.`);
    }
  }

  if (workshop.grade !== null && typeof workshop.grade !== "string") {
    errors.push("grade must be a string or null.");
  }

  if (
    typeof workshop.informationUrl === "string" &&
    !isOfficialSaitUrl(workshop.informationUrl)
  ) {
    errors.push("informationUrl must use the official sait.ca domain.");
  }

  if (
    typeof workshop.registrationUrl === "string" &&
    !workshop.registrationUrl.startsWith("https://")
  ) {
    errors.push("registrationUrl must be an https URL.");
  }

  if (!["in-person", "online", "hybrid"].includes(workshop.learningMode)) {
    errors.push("learningMode must be in-person, online, or hybrid.");
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

export async function collectSaitWorkshops({
  fetchImpl = globalThis.fetch,
  indexUrl = SAIT_DIGITAL_YOUTH_INDEX_URL,
  now = () => new Date(),
  limit = Infinity,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required to scrape SAIT.");
  }

  const indexHtml = await fetchOfficialPage(indexUrl, fetchImpl);
  const workshopUrls = extractSaitWorkshopLinks(indexHtml, indexUrl);

  if (workshopUrls.length === 0) {
    throw new Error(
      `No SAIT Digital Youth workshop pages were found from ${indexUrl}.`
    );
  }

  const workshops = [];
  const failures = [];

  for (const informationUrl of workshopUrls.slice(0, limit)) {
    try {
      const html = await fetchOfficialPage(informationUrl, fetchImpl);
      workshops.push(extractSaitWorkshop(html, informationUrl, now));
    } catch (error) {
      failures.push({ url: informationUrl, error });
    }
  }

  return { discovered: workshopUrls.length, workshops, failures };
}
