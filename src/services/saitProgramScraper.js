import {
  normalizeSaitProgram,
} from "./saitProgramNormalization.js";

export const SAIT_PROGRAM_INDEX_URL =
  "https://www.sait.ca/programs-and-courses";
export const SAIT_SITEMAP_INDEX_URL =
  "https://www.sait.ca/sitemap/sitemap-index.xml";

const SAIT_PROGRAM_PATH_TYPES = new Set([
  "certificates",
  "degrees",
  "diplomas",
  "pre-employment",
]);

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([a-f\d]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );
}

function stripTags(value) {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
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

function getMetaContent(html, keyName, keyValue) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = getTagAttributes(match[0]);
    if (
      (attributes[keyName] || "").toLowerCase() ===
      keyValue.toLowerCase()
    ) {
      return stripTags(attributes.content || "");
    }
  }

  return "";
}

function getPageTitle(html) {
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const documentTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);

  return stripTags(
    heading?.[1] ||
      getMetaContent(html, "property", "og:title") ||
      documentTitle?.[1] ||
      ""
  ).replace(/\s*[|–-]\s*SAIT.*$/i, "");
}

function isProgramPageUrl(url, baseUrl) {
  const base = new URL(baseUrl);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const programPrefix = ["programs-and-courses"];

  return (
    url.protocol === "https:" &&
    (url.hostname === "sait.ca" ||
      url.hostname.endsWith(".sait.ca")) &&
    pathParts.length >= 3 &&
    programPrefix.every((part, index) => pathParts[index] === part) &&
    SAIT_PROGRAM_PATH_TYPES.has(pathParts[1]) &&
    url.pathname !== base.pathname
  );
}

export function extractSaitProgramLinks(html, baseUrl = SAIT_PROGRAM_INDEX_URL) {
  const indexUrl = new URL(baseUrl);
  const programLinks = new Set();

  for (const match of html.matchAll(
    /<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi
  )) {
    const href = decodeHtmlEntities(match[1] || match[2] || match[3] || "");

    try {
      const url = new URL(href, indexUrl);

      if (isProgramPageUrl(url, indexUrl)) {
        url.hash = "";
        url.search = "";
        programLinks.add(url.toString().replace(/\/$/, ""));
      }
    } catch {
      // Invalid links are ignored; only official SAIT URLs are followed.
    }
  }

  return [...programLinks].sort();
}

export function extractSaitProgramSitemapUrl(sitemapIndexXml) {
  for (const match of sitemapIndexXml.matchAll(
    /<loc>\s*([^<]+)\s*<\/loc>/gi
  )) {
    const location = decodeHtmlEntities(match[1].trim());

    try {
      const url = new URL(location);
      if (
        (url.hostname === "sait.ca" ||
          url.hostname.endsWith(".sait.ca")) &&
        /\/sitemap\/index\/sitemap-sait\.xml$/i.test(url.pathname)
      ) {
        return url.toString();
      }
    } catch {
      // Continue past invalid sitemap entries.
    }
  }

  throw new Error("The SAIT sitemap index did not include sitemap-sait.xml.");
}

export function extractSaitProgramUrlsFromSitemap(sitemapXml) {
  const programUrls = new Set();
  const sitemapUrl = new URL(SAIT_PROGRAM_INDEX_URL);

  for (const match of sitemapXml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
    const location = decodeHtmlEntities(match[1].trim());

    try {
      const url = new URL(location);
      if (isProgramPageUrl(url, sitemapUrl)) {
        url.hash = "";
        url.search = "";
        programUrls.add(url.toString().replace(/\/$/, ""));
      }
    } catch {
      // Continue past invalid sitemap entries.
    }
  }

  return [...programUrls].sort();
}

function getSummaryField(text, label, endLabels) {
  const labelMatch = new RegExp(`${label}\\s*:\\s*`, "i").exec(text);
  if (!labelMatch) {
    return "";
  }

  const valueStart = labelMatch.index + labelMatch[0].length;
  const endIndexes = endLabels
    .map((endLabel) =>
      text.toLowerCase().indexOf(endLabel.toLowerCase(), valueStart)
    )
    .filter((index) => index !== -1);
  const valueEnd = endIndexes.length
    ? Math.min(...endIndexes)
    : text.length;

  return text.slice(valueStart, valueEnd).trim();
}

function getProgramLocation(locationText) {
  const campusMatch = locationText.match(/\(([^)]+)\)/);
  if (campusMatch) {
    return campusMatch[1].trim();
  }

  return /\bonline\b/i.test(locationText) ? "Online" : null;
}

export function extractRawSaitProgram(html, informationUrl) {
  const title = getPageTitle(html);
  const description =
    getMetaContent(html, "name", "description") ||
    getMetaContent(html, "property", "og:description");
  const mainContent = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const pageText = stripTags(mainContent?.[1] || html);

  if (!title) {
    throw new Error(`No program title was found at ${informationUrl}.`);
  }

  const credential = getSummaryField(pageText, "Credential", [
    "More info on program credentials",
    "Program length:",
  ]);
  const duration = getSummaryField(pageText, "Program length", [
    "Learn more about program length",
    "Location:",
  ]);
  const locationText = getSummaryField(pageText, "Location", [
    "More info on program location",
    "International applicant info:",
    "Faculty:",
  ]);
  const programArea = getSummaryField(pageText, "Faculty", [
    "Close Credit credentials",
    "More info",
  ]);
  const status =
    /\b(?:program|credential)\s+(?:is\s+)?(?:no longer offered|no longer available|discontinued)\b/i.test(
      pageText
    )
      ? "inactive"
      : "active";

  return {
    title,
    description,
    informationUrl,
    credential: credential || null,
    programArea: programArea || null,
    learningMode: null,
    location: getProgramLocation(locationText),
    duration: duration || null,
    admissionRequirements: [],
    careerAreas: [],
    status,
    sourceText: locationText,
  };
}

export async function fetchOfficialPage(url, fetchImpl) {
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(30000),
    headers: {
      accept: "text/html",
      "user-agent": "SAIT-Youth-Initiative-Program-Indexer/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `SAIT page request failed (${response.status} ${response.statusText}): ${url}`
    );
  }

  return response.text();
}

export async function collectSaitPrograms({
  fetchImpl = globalThis.fetch,
  indexUrl = SAIT_PROGRAM_INDEX_URL,
  now = () => new Date(),
  limit = Infinity,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required to scrape SAIT.");
  }

  const indexHtml = await fetchOfficialPage(indexUrl, fetchImpl);
  let programUrls = extractSaitProgramLinks(indexHtml, indexUrl);

  if (programUrls.length === 0) {
    const sitemapIndexXml = await fetchOfficialPage(
      SAIT_SITEMAP_INDEX_URL,
      fetchImpl
    );
    const sitemapUrl = extractSaitProgramSitemapUrl(sitemapIndexXml);
    const sitemapXml = await fetchOfficialPage(sitemapUrl, fetchImpl);
    programUrls = extractSaitProgramUrlsFromSitemap(sitemapXml);
  }

  if (programUrls.length === 0) {
    throw new Error(
      `No SAIT post-secondary program pages were found from ${indexUrl}.`
    );
  }

  const discovered = programUrls.length;
  const programs = [];
  const failures = [];

  for (const informationUrl of programUrls.slice(0, limit)) {
    try {
      const html = await fetchOfficialPage(informationUrl, fetchImpl);
      programs.push(
        normalizeSaitProgram(
          extractRawSaitProgram(html, informationUrl),
          now
        )
      );
    } catch (error) {
      failures.push({ url: informationUrl, error });
    }
  }

  return { discovered, programs, failures };
}

export async function scrapeSaitPrograms(options = {}) {
  const { programs, failures } = await collectSaitPrograms(options);

  if (failures.length > 0) {
    throw failures[0].error;
  }

  return programs;
}