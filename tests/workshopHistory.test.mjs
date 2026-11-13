import test from "node:test";
import assert from "node:assert/strict";
import { workshopCompletionSnapshot, withCompletionArtwork } from "../src/services/workshopHistory.mjs";

test("completed workshop history survives catalogue removal independently", () => {
  const workshop = { id: "ai-2026", title: "AI Workshop", category: "Technology", offeringYear: "2026", xpReward: 100 };
  const registration = { id: "reg1", workshopId: "ai-2026", status: "completed", completedAt: "2026-10-20T00:00:00Z" };
  const snapshot = workshopCompletionSnapshot(workshop, registration, { status: "completed", points: 100 });
  assert.equal(snapshot.title, "AI Workshop");
  assert.equal(snapshot.xpReward, 100);
  assert.equal(snapshot.completedAt, registration.completedAt);
  assert.equal(snapshot.category, "Technology");
  assert.equal(snapshot.offeringYear, "2026");
});

test("cannot create a history snapshot for an incomplete registration", () => {
  assert.throws(() => workshopCompletionSnapshot({ id: "ai" }, { id: "x", workshopId: "ai", status: "registered" }), /completed/);
});

test("cannot attach a workshop snapshot to the wrong registration", () => {
  assert.throws(() => workshopCompletionSnapshot({ id: "ai" }, { id: "x", workshopId: "robotics", status: "completed" }), /mismatch/);
});

test("completion snapshot preserves assigned artwork after catalogue removal", () => {
  const workshop = {
    id: "coding-2026", title: "Coding Reality", category: "Technology",
    image: "/images/workshops/10_digital-creators-coding-reality.jpg",
    imageAssetId: "photo-10", imageStatus: "assigned", xpReward: 80,
  };
  const registration = {
    id: "reg-past-1", workshopId: workshop.id,
    status: "completed", completedAt: "2026-10-20T12:00:00.000Z",
  };
  const saved = workshopCompletionSnapshot(workshop, registration, {
    status: "completed", points: 40,
  });
  assert.equal(saved.image, workshop.image);
  assert.equal(saved.imageAssetId, workshop.imageAssetId);
  assert.equal(saved.imageStatus, workshop.imageStatus);
  assert.equal(saved.xpReward, 40);
  // Do not change a student's recorded history when a future catalogue
  // version uses a different image or XP reward.
  assert.deepEqual(withCompletionArtwork(saved, {
    image: "/images/other.jpg", xpReward: 500,
  }), saved);
});

test("legacy completion without artwork can borrow current catalogue image", () => {
  const oldSnapshot = {
    id: "robotics-2026", title: "Robotics 2026", xpReward: 50,
    category: "Technology", completedAt: "2026-09-12T12:00:00Z",
  };
  const currentCatalogue = {
    id: "robotics-2026", title: "Robotics 2027", xpReward: 200,
    image: "/images/workshops/58_extra-drones-and-robotics.jpg",
    imageAssetId: "photo-58", imageStatus: "assigned",
  };
  const enriched = withCompletionArtwork(oldSnapshot, currentCatalogue);
  assert.equal(enriched.image, currentCatalogue.image);
  assert.equal(enriched.title, oldSnapshot.title);
  assert.equal(enriched.xpReward, oldSnapshot.xpReward);
  assert.equal(enriched.completedAt, oldSnapshot.completedAt);
  assert.equal(oldSnapshot.image, undefined); // Never mutate stored snapshots.
  assert.equal(withCompletionArtwork(oldSnapshot, null).image, null);
  assert.equal(withCompletionArtwork(null, currentCatalogue), currentCatalogue);
});
