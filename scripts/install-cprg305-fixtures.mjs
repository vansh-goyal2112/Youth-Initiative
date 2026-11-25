import { readFileSync, writeFileSync } from "node:fs";

// Only the disposable course workflow applies these patches to its checkout.
// The image has no published port and runs on a Docker network without egress.
function replace(file, pattern, body) {
  const source = readFileSync(file, "utf8");
  if (!pattern.test(source)) throw new Error("Fixture insertion point missing: " + file);
  writeFileSync(file, source.replace(pattern, match => match + "\n" + body + "\n"));
}
const db = "src/services/cosmosData.js";
const records = `
const fixtureStudents = Object.fromEntries(["student-a", "student-b", "inactive", "minor-pending"].map(id => [id, {
  id, firebaseUid: id, role: "student", firstName: "QA", lastName: id,
  schoolGrade: id === "student-b" ? "6" : "9",
  accountStatus: id === "inactive" ? "inactive" : "active",
  requiresParentalConsent: id === "minor-pending", consentStatus: "pending"
}]));
const fixtureWorkshops = Array.from({length: 100}, (_, i) => ({
  id: "qa-workshop-" + String(i + 1).padStart(3, "0"), title: "Fixture experience " + (i + 1),
  status: "active", minGrade: 7, maxGrade: 12, category: "Technology",
  programArea: "Technology", xpReward: 125, xpRewardSource: "manual",
}));
const fixtureRegistrations = fixtureWorkshops.slice(0,20).map(w=>({
  id: "qa-reg-" + w.id, studentId: "student-a", workshopId: w.id, status: "registered"
}));
`;
writeFileSync(db, readFileSync(db, "utf8") + "\n" + records);
replace(db, /export async function readCosmosDocument\s*\([^]*?\)\s*\{/, `
  if (containerName === "students") return structuredClone(fixtureStudents[id] ?? null);
  if (containerName === "workshops") return structuredClone(fixtureWorkshops.find(w => w.id === id) ?? null);
  throw new Error("No QA fixture for this document");
`);
replace(db, /export async function queryCosmosDocuments\s*\([^]*?\)\s*\{/, `
  if (containerName === "workshops") return structuredClone(fixtureWorkshops);
  if (containerName === "registrations") return structuredClone(fixtureRegistrations);
  throw new Error("No QA fixture for this query");
`);
const auth = "src/services/firebaseAdmin.js";
const original = readFileSync(auth,"utf8");
writeFileSync(auth, original + `
export const qaFixtureAuth = { async verifyIdToken(token) {
  const uid = token.startsWith("fixture-") ? token.slice(8) : "";
  if (!["student-a","student-b","inactive","minor-pending"].includes(uid)) throw new Error("Invalid fixture identity");
  return {uid, email: uid + "@example.test"};
}};
`);
const access = "src/services/studentAccess.js";
writeFileSync(access, readFileSync(access,"utf8").replace(/\badminAuth\b/g, "qaFixtureAuth"));
const checkImport = readFileSync(access, "utf8").replace('from "@/services/appCheckServer"', 'from "@/services/cprg305AppCheckFixture"');
writeFileSync(access, checkImport);
writeFileSync("src/services/cprg305AppCheckFixture.js", `
export async function requireAppCheck(request) {
  if (request.headers.get("x-firebase-appcheck") !== "fixture-app")
    throw Object.assign(new Error("Missing fixture App Check token"), {status: 401});
}
`);
