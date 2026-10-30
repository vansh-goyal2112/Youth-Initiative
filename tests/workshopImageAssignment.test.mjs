import test from "node:test";
import assert from "node:assert/strict";
import { assignWorkshopImage, usedWorkshopImageIds, WORKSHOP_IMAGE_LIBRARY, findWorkshopImageByTitle, resolveWorkshopImage, shouldAssignWorkshopImage } from "../src/utils/workshopImageAssignment.mjs";

test("library contains 59 available distinct image assets and paths", () => {
  assert.equal(WORKSHOP_IMAGE_LIBRARY.length, 59);
  assert.equal(new Set(WORKSHOP_IMAGE_LIBRARY.map(asset => asset.id)).size, 59);
  assert.equal(new Set(WORKSHOP_IMAGE_LIBRARY.map(asset => asset.url)).size, 59);
  assert.ok(WORKSHOP_IMAGE_LIBRARY.every(asset => asset.url.startsWith("/images/workshops/")));
});

test("exact workshop titles receive their matching photographs", () => {
  const match = assignWorkshopImage({title: "Art of The Possible: Coding", category: "Technology"});
  assert.equal(match.imageAssetId, "photo-03");
  assert.equal(match.image, "/images/workshops/03_art-of-the-possible-coding.jpg");
  assert.equal(findWorkshopImageByTitle("art of the possible: coding").id, "photo-03");
});

test("assignment never reuses an already occupied image", () => {
  const used = new Set(["photo-03"]);
  const match = assignWorkshopImage({title:"Art of The Possible: Coding"}, used);
  assert.notEqual(match.imageAssetId,"photo-03");
  assert.ok(match.imageStatus === "assigned" || match.imageStatus === "needs_image");
});

test("assigns different workshop pictures to different workshops", () => {
  const used = new Set();
  const first=assignWorkshopImage({title:"Art of The Possible: Coding"}, used);
  used.add(first.imageAssetId);
  const second=assignWorkshopImage({title:"Business Titans"}, used);
  assert.equal(first.imageAssetId,"photo-03");
  assert.equal(second.imageAssetId,"photo-08");
});

test("all images occupied returns explicit needs_image status", () => {
  const used = new Set(WORKSHOP_IMAGE_LIBRARY.map(a=>a.id));
  assert.deepEqual(assignWorkshopImage({title:"Business Titans"},used),{image:null,imageAssetId:null,imageStatus:"needs_image"});
});

test("unrelated future workshops are not assigned random photos", () => {
  const match=assignWorkshopImage({title:"Unrelated Quantum Ballet",category:"general"});
  assert.equal(match.imageStatus,"needs_image");
});

test("renders the stable original image even before a database backfill", () => {
  assert.equal(resolveWorkshopImage({title:"Business Titans"}),"/images/workshops/08_business-titans.jpg");
  assert.equal(resolveWorkshopImage({title:"Business Titans",image:"/custom.webp"}),"/custom.webp");
});

test("ignores current record when collecting used assets", () => {
  const used=usedWorkshopImageIds([{id:"one",imageAssetId:"photo-01"},{id:"two",imageAssetId:"photo-02"}],"one");
  assert.deepEqual([...used],["photo-02"]);
});

test("Aviation Bundle uses the existing youth-aviation photo, not a missing file", () => {
  const youthAviation = "/images/workshops/36_exploring-aviation-day.jpg";
  assert.equal(findWorkshopImageByTitle("Aviation Bundle"), null);
  const assigned = assignWorkshopImage({ title: "Aviation Bundle" }, new Set(["photo-36"]));
  assert.deepEqual(assigned, {
    image: youthAviation,
    imageAssetId: "aviation-bundle-shared-36",
    imageStatus: "assigned",
  });
  assert.equal(resolveWorkshopImage({ title: "Aviation Bundle" }), youthAviation);
  assert.equal(resolveWorkshopImage({ title: "Aviation Bundle", image: "/images/workshops/50_aviation-bundle.jpg" }), youthAviation);
  assert.equal(resolveWorkshopImage({ title: "Aviation Bundle", image: "/images/landing/youth-campus.png" }), youthAviation);
  assert.equal(resolveWorkshopImage({ title: "Aviation Bundle", image: "/custom/aviation.webp" }), "/custom/aviation.webp");
  assert.equal(assignWorkshopImage({ title: "Aviation Bundle" }, new Set(["aviation-bundle-shared-36"])).imageStatus, "needs_image");
});

test("old automatically assigned pictures are replaced but custom artwork is kept", () => {
  assert.equal(shouldAssignWorkshopImage({image:"/images/landing/youth-coding.png",imageAssetId:"coding-01"}),true);
  assert.equal(shouldAssignWorkshopImage({image:"/images/landing/youth-campus.png"}),true);
  assert.equal(shouldAssignWorkshopImage({image:"/images/workshops/50_aviation-bundle.jpg",imageAssetId:"photo-50"}),true);
  assert.equal(shouldAssignWorkshopImage({image:null,imageAssetId:null}),true);
  assert.equal(shouldAssignWorkshopImage({image:"/images/workshops/03_art-of-the-possible-coding.jpg",imageAssetId:"photo-03"}),false);
  assert.equal(shouldAssignWorkshopImage({image:"/images/custom/my-image.webp"}),false);
});

test("student aviation image remains available before and after backfilling the assignment", async () => {
  const { getWorkshopImage } = await import("../src/utils/getWorkshopImage.js");
  const aviation = "/images/workshops/36_exploring-aviation-day.jpg";
  assert.equal(getWorkshopImage({ title: "Aviation Bundle", imageStatus: "needs_image", image: null }), aviation);
  assert.equal(getWorkshopImage({ title: "Aviation Bundle", imageStatus: "needs_image", image: "/images/landing/youth-campus.png" }), aviation);
  assert.equal(getWorkshopImage({ title: "Aviation Bundle", imageStatus: "assigned", image: aviation }), aviation);
  assert.equal(getWorkshopImage({ title: "Art of The Possible: Coding" }), "/images/workshops/03_art-of-the-possible-coding.jpg");
});
