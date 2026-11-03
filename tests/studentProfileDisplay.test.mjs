import assert from "node:assert/strict";
import test from "node:test";

import {
  formatLearningPreference,
  formatStudentBirthDate,
  formatStudentInterest,
  profileProgress,
  studentContactEmail,
  studentDisplayName,
  studentInitials,
  studentInterests,
  studentYouthId,
} from "../src/utils/studentProfileDisplay.mjs";

const cosmosStudent = {
  id: "firebase-uid-not-youth-id",
  firebaseUid: "firebase-uid-not-youth-id",
  youthId: "YG-2026-501",
  contactEmail: "student@example.ca",
  internalEmail: "yg-2026-501@youthinitiative.local",
  firstName: "Jordan",
  lastName: "Explorer",
  dateOfBirth: "2011-10-16",
  interests: ["robotics", "artificial intelligence"],
  learningMode: "both",
  totalXp: 140,
  level: 2,
  badgeCount: 1,
  completedWorkshopCount: 2,
};

test("student identity comes from Cosmos youthId, never internal Firebase ID", () => {
  assert.equal(studentYouthId(cosmosStudent), "YG-2026-501");
  assert.equal(studentContactEmail(cosmosStudent), "student@example.ca");
  assert.equal(studentYouthId({ id: "firebase-uid" }), null);
  assert.equal(studentContactEmail({ email: "yg-2026-501@youthinitiative.local" }), null);
  assert.equal(studentContactEmail({ contactEmail: "" }), null);
});

test("profile display gracefully handles partial student records", () => {
  assert.equal(studentDisplayName(cosmosStudent), "Jordan Explorer");
  assert.equal(studentInitials(cosmosStudent), "JE");
  assert.equal(studentDisplayName({}), "Young Explorer");
  assert.equal(studentInitials({ firstName: "Alex" }), "A");
  assert.equal(studentInterests({ interests: null }).length, 0);
  assert.equal(studentInterests(cosmosStudent).length, 2);
  assert.equal(formatStudentInterest("artificial intelligence"), "Artificial Intelligence");
});

test("date of birth has consistent calendar-day formatting", () => {
  assert.match(formatStudentBirthDate("2011-10-16"), /October 16, 2011/);
  assert.match(formatStudentBirthDate("2011-10-16T00:00:00Z"), /October 16, 2011/);
  assert.equal(formatStudentBirthDate("2011-02-30"), null);
  assert.equal(formatStudentBirthDate(null), null);
  assert.equal(formatLearningPreference("both"), "Online & in person");
  assert.equal(formatLearningPreference("unknown"), "Not selected yet");
});

test("profile uses current gamification API progress over outdated document totals", () => {
  const info = profileProgress(cosmosStudent, {
    totalXp: 470,
    level: 4,
    badgeCount: 3,
    completedWorkshops: 5,
    progressPercentage: 21,
    nextLevelXp: 700,
    rank: "Innovation Builder",
  });
  assert.deepEqual(info, {
    totalXp: 470,
    level: 4,
    badges: 3,
    completed: 5,
    nextLevelXp: 700,
    progressPercentage: 21,
    rank: "Innovation Builder",
  });
});

test("profile totals degrade safely when gamification API is unavailable", () => {
  const info = profileProgress(cosmosStudent, null);
  assert.equal(info.totalXp, 140);
  assert.equal(info.level, 2);
  assert.equal(info.badges, 1);
  assert.equal(info.completed, 2);
  assert.equal(info.nextLevelXp, null);
  assert.equal(info.progressPercentage, 0);

  const invalid = profileProgress({ totalXp: -4, level: -1, badgeCount: "not a number" }, null);
  assert.equal(invalid.totalXp, 0);
  assert.equal(invalid.level, 1);
  assert.equal(invalid.badges, 0);
});
