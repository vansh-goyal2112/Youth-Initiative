// Workshop image library. Add real, optimized files to public/images/workshops/
// and register them here. Missing images are never silently referenced.
export const WORKSHOP_IMAGE_LIBRARY = Object.freeze([
 {id:"coding-01",url:"/images/landing/youth-coding.png",tags:["coding","programming","technology","digital","computer","ai"]},
 {id:"trades-01",url:"/images/landing/youth-trades.png",tags:["trades","construction","welding","woodwork","carpentry"]},
 {id:"campus-01",url:"/images/landing/youth-campus.png",tags:["general","leadership","business","career","campus"]},
]);
export function workshopImageKeywords(workshop) {
 return String([workshop.title,workshop.category,workshop.programArea,workshop.description].filter(Boolean).join(" ")).toLowerCase();
}
export function assignWorkshopImage(workshop,usedImageIds=new Set(),library=WORKSHOP_IMAGE_LIBRARY) {
 const text=workshopImageKeywords(workshop);
 const unused=library.filter(asset=>!usedImageIds.has(asset.id));
 if(!unused.length)return {image:null,imageAssetId:null,imageStatus:"needs_image"};
 const ranked=unused.map(asset=>({
  asset,score:asset.tags.reduce((n,tag)=>n+(text.includes(tag)?(tag.includes(" ")?5:3):0),0)
 })).sort((a,b)=>b.score-a.score||a.asset.id.localeCompare(b.asset.id));
 if (ranked[0].score <= 0) return {image:null,imageAssetId:null,imageStatus:"needs_image"};
 const asset=ranked[0].asset;
 return {image:asset.url,imageAssetId:asset.id,imageStatus:"assigned"};
}
export function usedWorkshopImageIds(workshops,excludeId) {
 return new Set(workshops.filter(w=>w.id!==excludeId && w.imageAssetId).map(w=>w.imageAssetId));
}
export function resolveWorkshopImage(workshop) {
 return workshop?.image || "/images/landing/youth-campus.png";
}
