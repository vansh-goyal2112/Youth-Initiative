import test from "node:test";
import assert from "node:assert/strict";
import { assignWorkshopImage, usedWorkshopImageIds, WORKSHOP_IMAGE_LIBRARY } from "../src/utils/workshopImageAssignment.mjs";
test("image matcher prioritizes category and subject", ()=>{
 const match=assignWorkshopImage({title:"Introduction to Robotics",category:"Technology"});
 assert.equal(match.imageAssetId,"coding-01");
});
test("never assigns an image twice when all are occupied",()=>{
 const used=new Set(WORKSHOP_IMAGE_LIBRARY.map(a=>a.id));
 assert.deepEqual(assignWorkshopImage({title:"new workshop"},used),{image:null,imageAssetId:null,imageStatus:"needs_image"});
});
test("does not reuse an image in an import batch",()=>{
 const used=new Set();
 const first=assignWorkshopImage({title:"coding"},used);used.add(first.imageAssetId);
 const second=assignWorkshopImage({title:"construction"},used);used.add(second.imageAssetId);
 assert.notEqual(first.imageAssetId,second.imageAssetId);
});
test("ignores current record when collecting used assets",()=>{
 const used=usedWorkshopImageIds([{id:"one",imageAssetId:"a"},{id:"two",imageAssetId:"b"}],"one");
 assert.deepEqual([...used],["b"]);
});
