import test from "node:test";
import assert from "node:assert/strict";
import {
  assignWorkshopImage,
  usedWorkshopImageIds,
  workshopImageUsage,
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

test("a completely new robotics workshop automatically gets a related photo", () => {
  const result = assignWorkshopImage({
    id:"new-robotics-2027",
    title:"Robotics and Drones for Beginners",
    programArea:"Emerging Technology",
    category:"Technology",
    description:"Build a robot and learn programming with sensors.",
  });
  assert.equal(result.imageStatus, "assigned");
  const asset = WORKSHOP_IMAGE_LIBRARY.find(p => p.id === result.imageAssetId);
  assert.match(asset.title.toLowerCase(), /robot|drone/);
});

test("a new baking workshop gets a culinary photo, not a coding photo", () => {
  const result = assignWorkshopImage({
    id:"new-baking",
    title:"Decorating Cupcakes",
    programArea:"Culinary",
    category:"Culinary & Hospitality",
    description:"Students bake cupcakes, pastries and cakes.",
  });
  assert.equal(result.imageStatus, "assigned");
  const asset = WORKSHOP_IMAGE_LIBRARY.find(p => p.id === result.imageAssetId);
  assert.match(asset.title.toLowerCase(), /bak|culinary|kitchen|cooking/);
});

test("a new unknown subject still receives a stable, valid library image", () => {
  const unknown = { id:"pottery-1", title:"Pottery Wheel for Beginners", category:"General" };
  const first = assignWorkshopImage(unknown);
  const second = assignWorkshopImage(unknown);
  assert.deepEqual(first, second);
  assert.equal(first.imageStatus, "assigned");
  assert.ok(WORKSHOP_IMAGE_LIBRARY.some(asset => asset.id === first.imageAssetId));
});

test("least-used fallback is chosen for an unknown subject", () => {
  const others = new Map(WORKSHOP_IMAGE_LIBRARY.map(asset => [asset.id, 3]));
  others.set("photo-58", 0);
  const image = assignWorkshopImage({id:"new-pottery-2",title:"Pottery Wheel"}, others);
  assert.equal(image.imageAssetId, "photo-58");
});

test("new workshops still get a photo after every file has been used", () => {
  const used = new Map(WORKSHOP_IMAGE_LIBRARY.map(asset => [asset.id, 1]));
  const match = assignWorkshopImage({id:"after-59",title:"Unknown Circus Performance"}, used);
  assert.equal(match.imageStatus, "assigned");
  assert.ok(WORKSHOP_IMAGE_LIBRARY.some(asset => asset.id === match.imageAssetId));
});

test("no photos means explicit needs_image rather than a broken URL", () => {
  assert.deepEqual(assignWorkshopImage({title:"Anything"},new Map(),[]),{
    image:null,imageAssetId:null,imageStatus:"needs_image",
  });
});

test("usage map counts reused images, including the previous aviation alias", () => {
  const usage = workshopImageUsage([
    {id:"a", imageAssetId:"photo-36"},
    {id:"b", imageAssetId:"aviation-bundle-shared-36", image:"/images/workshops/36_exploring-aviation-day.jpg"},
    {id:"c", imageAssetId:"photo-03"},
    {id:"d", image:"/images/workshops/03_art-of-the-possible-coding.jpg"},
  ]);
  assert.equal(usage.get("photo-36"), 2);
  assert.equal(usage.get("photo-03"), 2);
  assert.equal(workshopImageUsage([{id:"a",imageAssetId:"photo-36"}],"a").size, 0);
});

test("aviation bundle is assigned existing young people's aviation photo", () => {
  const aviation = "/images/workshops/36_exploring-aviation-day.jpg";
  const assigned = assignWorkshopImage({title:"Aviation Bundle"},new Set(["photo-36"]));
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

test("old used-image set helper still works", () => {
  const used=usedWorkshopImageIds([{id:"one",imageAssetId:"photo-01"},{id:"two",imageAssetId:"photo-02"}],"one");
  assert.deepEqual([...used],["photo-02"]);
});

test("student views show available aviation artwork before and after backfill", async () => {
  const { getWorkshopImage } = await import("../src/utils/getWorkshopImage.js");
  const aviation = "/images/workshops/36_exploring-aviation-day.jpg";
  assert.equal(getWorkshopImage({title:"Aviation Bundle",imageStatus:"needs_image",image:null}),aviation);
  assert.equal(getWorkshopImage({title:"Aviation Bundle",imageStatus:"assigned",image:aviation}),aviation);
  assert.equal(getWorkshopImage({title:"Art of The Possible: Coding"}),"/images/workshops/03_art-of-the-possible-coding.jpg");
});
