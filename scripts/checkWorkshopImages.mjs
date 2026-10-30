import { stat } from "node:fs/promises";
import { join } from "node:path";
import { WORKSHOP_IMAGE_LIBRARY } from "../src/utils/workshopImageAssignment.mjs";

const missing = [];
const tooSmall = [];
for (const photo of WORKSHOP_IMAGE_LIBRARY) {
  const filepath = join(process.cwd(), "public", photo.url.replace(/^\//, ""));
  try {
    const file = await stat(filepath);
    if (!file.isFile()) missing.push(photo.url);
    else if (file.size < 20_000) tooSmall.push(photo.url);
  } catch {
    missing.push(photo.url);
  }
}
console.log(`Workshop images: ${WORKSHOP_IMAGE_LIBRARY.length - missing.length}/${WORKSHOP_IMAGE_LIBRARY.length} found.`);
if (missing.length) console.error("Missing files:\n" + missing.map(name => "- " + name).join("\n"));
if (tooSmall.length) console.warn("Potentially low-quality or incomplete files:\n" + tooSmall.join("\n"));
if (missing.length || tooSmall.length) process.exitCode = 1;
