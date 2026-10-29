import { requireAdminPermission, adminAccessResponse } from "@/services/adminAccess";
import { queryCosmosDocuments, replaceCosmosDocument, cosmosNow } from "@/services/cosmosData";
import { assignWorkshopImage, usedWorkshopImageIds } from "@/utils/workshopImageAssignment.mjs";
export const runtime = "nodejs";
export async function POST(request) {
 try {
  await requireAdminPermission(request,"workshops.edit");
  const all=await queryCosmosDocuments("workshops","SELECT * FROM c");
  const used=usedWorkshopImageIds(all);
  let assigned=0,needsImage=0,unchanged=0;
  for (const workshop of all) {
   if(workshop.imageAssetId || workshop.image){unchanged++;continue;}
   const assignment=assignWorkshopImage(workshop,used);
   await replaceCosmosDocument("workshops",workshop,{...assignment,updatedAt:cosmosNow()});
   if(assignment.imageAssetId){used.add(assignment.imageAssetId);assigned++;}else needsImage++;
  }
  return Response.json({success:true,assigned,needsImage,unchanged},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  const access=adminAccessResponse(error);if(access)return access;
  console.error("Workshop artwork assignment error:",error?.message);
  return Response.json({message:"Could not assign workshop images."},{status:500});
 }
}
