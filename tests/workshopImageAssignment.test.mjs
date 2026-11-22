import test from "node:test";
import assert from "node:assert/strict";
import {
  assignWorkshopImage,
  WORKSHOP_IMAGE_PLACEHOLDER,
  WORKSHOP_IMAGE_LIBRARY,
  findWorkshopImageByTitle,
  resolveWorkshopImage,
  shouldAssignWorkshopImage,
} from "../src/utils/workshopImageAssignment.mjs";

test("59 distinct local photos are registered, without the missing aviation file", () => {
  assert.equal(WORKSHOP_IMAGE_LIBRARY.length, 59);
  assert.equal(new Set(WORKSHOP_IMAGE_LIBRARY.map(asset => asset.id)).size, 59);
  assert.equal(new Set(WORKSHOP_IMAGE_LIBRARY.map(asset => asset.url)).size, 59);
  assert.ok(WORKSHOP_IMAGE_LIBRARY.every(asset => asset.url.startsWith("/images/workshops/")));
  assert.ok(!WORKSHOP_IMAGE_LIBRARY.some(asset => asset.url.includes("/50_aviation-bundle.jpg")));
});

test("exact workshop title still receives its specifically curated photo", () => {
  const match = assignWorkshopImage({title:"Art of The Possible: Coding",category:"Technology"});
  assert.equal(match.imageAssetId, "photo-03");
  assert.equal(match.image, "/images/workshops/03_art-of-the-possible-coding.jpg");
  assert.equal(findWorkshopImageByTitle("art of the possible: coding").id, "photo-03");
});

test("manual backfill leaves workshops without a curated match on the placeholder", () => {
  const workshop = { title: "Robotics and Drones for Beginners", category: "Technology" };
  assert.deepEqual(assignWorkshopImage(workshop), WORKSHOP_IMAGE_PLACEHOLDER);
  assert.deepEqual(WORKSHOP_IMAGE_PLACEHOLDER, {
    image: null, imageAssetId: null, imageStatus: "needs_image",
  });
});

test("aviation bundle is assigned existing young people's aviation photo", () => {
  const aviation = "/images/workshops/36_exploring-aviation-day.jpg";
  const assigned = assignWorkshopImage({title:"Aviation Bundle"});
  assert.deepEqual(assigned,{
    image: aviation,
    imageAssetId:"photo-36",
    imageStatus:"assigned",
  });
  assert.equal(resolveWorkshopImage({title:"Aviation Bundle"}),aviation);
  assert.equal(resolveWorkshopImage({title:"Aviation Bundle",image:"/images/landing/youth-campus.png"}),aviation);
  assert.equal(resolveWorkshopImage({title:"Aviation Bundle",image:"/custom/aviation.webp"}),"/custom/aviation.webp");
});

test("legacy generic placeholders can be upgraded, but saved custom photos remain", () => {
  assert.equal(shouldAssignWorkshopImage({image:"/images/landing/youth-coding.png",imageAssetId:"coding-01"}),true);
  assert.equal(shouldAssignWorkshopImage({image:"/images/landing/youth-campus.png"}),true);
  assert.equal(shouldAssignWorkshopImage({image:"/images/workshops/50_aviation-bundle.jpg",imageAssetId:"photo-50"}),true);
  assert.equal(shouldAssignWorkshopImage({image:null,imageAssetId:null}),true);
  assert.equal(shouldAssignWorkshopImage({image:"/images/workshops/03_art-of-the-possible-coding.jpg",imageAssetId:"photo-03"}),false);
  assert.equal(shouldAssignWorkshopImage({image:"/custom/my-photo.webp"}),false);
});

test("student views show the placeholder for new workshops and keep their saved images", async () => {
  const { getWorkshopImage } = await import("../src/utils/getWorkshopImage.js");
  const aviation = "/images/workshops/36_exploring-aviation-day.jpg";
  assert.equal(getWorkshopImage({title:"Aviation Bundle",imageStatus:"needs_image",image:null}),null);
  assert.equal(getWorkshopImage({title:"Aviation Bundle",imageStatus:"assigned",image:aviation}),aviation);
  assert.equal(getWorkshopImage({title:"Art of The Possible: Coding",imageStatus:"needs_image"}),null);
  assert.equal(getWorkshopImage({title:"Art of The Possible: Coding"}),"/images/workshops/03_art-of-the-possible-coding.jpg");
});
