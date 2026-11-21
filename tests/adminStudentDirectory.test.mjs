import test from "node:test";
import assert from "node:assert/strict";
import {
  getPossibleDuplicateAccounts,
  summarizeStudentWorkshopHistory,
} from "../src/utils/adminStudentDirectory.mjs";

test("flags matching names and contact emails across student and pending accounts", () => {
  const flags = getPossibleDuplicateAccounts([
    { id: "a", fullName: "Alex  Rivera", contactEmail: "one@example.test" },
    { id: "b", firstName: "ALEX", lastName: "Rivera", contactEmail: "two@example.test" },
    { id: "c", fullName: "Sam Singh", contactEmail: "TWO@example.test" },
    { id: "empty", fullName: " ", contactEmail: "" },
  ], [
    { id: "a", fullName: "Sam Singh", email: "two@example.test" },
    { id: "empty", fullName: "", email: "" },
  ]);
  assert.deepEqual(flags.get("student:a"), ["name"]);
  assert.deepEqual(flags.get("student:b"), ["name", "email"]);
  assert.deepEqual(flags.get("student:c"), ["name", "email"]);
  assert.deepEqual(flags.get("pending:a"), ["name", "email"]);
  assert.equal(flags.has("student:empty"), false);
  assert.equal(flags.has("pending:empty"), false);
});

test("history uses the correct session ledger and preserves past workshop titles", () => {
  const history = summarizeStudentWorkshopHistory("student", [
    { id: "old", workshopId: "one", status: "completed", workshopSnapshot: { title: "Original name", xpReward: 150 } },
    { id: "pending", workshopId: "one", sessionId: "a", status: "completed", workshopSnapshot: { xpReward: 90 } },
    { id: "verified", workshopId: "one", sessionId: "b", status: "completed" },
    { id: "reversed", workshopId: "one", sessionId: "c", status: "reversed" },
    { id: "no-ledger", workshopId: "deleted", status: "completed", workshopSnapshot: { title: "Archived", xpReward: 100 } },
  ], [
    { id: "student_one", status: "completed", points: 75 },
    { id: "student_one_session_a", status: "processing", points: 90 },
    { id: "student_one_session_b", registrationId: "verified", status: "completed", points: 40 },
    { id: "student_one_session_c", registrationId: "reversed", status: "reversed", points: 50 },
  ], [{ id: "one", title: "New name" }]);
  const rows = Object.fromEntries(history.map(row => [row.id, row]));
  assert.equal(rows.old.title, "Original name");
  assert.equal(rows.old.xpAwarded, 75);
  assert.equal(rows.pending.xpAwarded, null);
  assert.equal(rows.pending.xpStatus, "processing");
  assert.equal(rows.verified.xpAwarded, 40);
  assert.equal(rows.reversed.xpAwarded, null);
  assert.equal(rows["no-ledger"].title, "Archived");
  assert.equal(rows["no-ledger"].xpAwarded, null);
});
