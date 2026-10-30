import test from "node:test";
import assert from "node:assert/strict";
import { assignWorkshopImage, usedWorkshopImageIds, WORKSHOP_IMAGE_LIBRARY, findWorkshopImageByTitle, resolveWorkshopImage } from "../src/utils/workshopImageAssignment.mjs";

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

test("omitted Aviation Bundle image never resolves to broken file or repeats another workshop photo", () => {
  assert.equal(findWorkshopImageByTitle("Aviation Bundle"), null);
  assert.equal(assignWorkshopImage({ title: "Aviation Bundle" }).imageStatus, "needs_image");
  assert.equal(resolveWorkshopImage({ title: "Aviation Bundle" }), null);
  assert.equal(resolveWorkshopImage({ title: "Aviation Bundle", image: "/images/workshops/50_aviation-bundle.jpg" }), null);
});
