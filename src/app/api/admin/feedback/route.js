import {requireAdminPermission,adminAccessResponse} from "@/services/adminAccess";
import {queryCosmosDocuments} from "@/services/cosmosData";
import {FEEDBACK_QUESTIONS} from "@/services/workshopFeedback.mjs";
export const runtime="nodejs";
export async function GET(request) {
  try {
    await requireAdminPermission(request,"reports.generate");
    const url=new URL(request.url);
    const workshopId=url.searchParams.get("workshopId")||"";
    const format=url.searchParams.get("format")||"json";
    if(format!=="json"&&format!=="csv")return Response.json({message:"Unsupported format"},{status:400});
    if(format==="csv")await requireAdminPermission(request,"reports.export");
    const completed=await queryCosmosDocuments("registrations",
      "SELECT c.workshopId,c.workshopSnapshot,c.workshopFeedback,c.completedAt FROM c WHERE IS_DEFINED(c.workshopFeedback) AND c.status = 'completed'");
    const rows=completed.filter(r=>r.workshopFeedback?.submittedAt && (!workshopId||r.workshopId===workshopId));
    // No student identity is returned or exported; only anonymized aggregated feedback.
    const grouped=new Map();
    for(const row of rows) {
      const key=row.workshopId;
      const item=grouped.get(key)||{id:key,title:row.workshopSnapshot?.title||"Workshop",offeringYear:row.workshopSnapshot?.offeringYear||null,responses:0,answers:{},comments:[],ratingTotal:0,ratingCount:0};
      item.responses++;
      for(const question of FEEDBACK_QUESTIONS) {
        const answer=row.workshopFeedback.answers?.[question.id];
        if(!answer)continue;
        item.answers[question.id]??={};
        item.answers[question.id][answer]=(item.answers[question.id][answer]||0)+1;
      }
      const stars=Number(String(row.workshopFeedback.answers?.enjoyment||"").match(/\((\d)\/5\)/)?.[1]||0);
      if(stars){item.ratingTotal+=stars;item.ratingCount++;}
      const note=row.workshopFeedback.comment;
      if(typeof note==="string"&&note.trim())item.comments.push(note.trim());
      grouped.set(key,item);
    }
    const workshops=Array.from(grouped.values()).map(item=>({...item,averageRating:item.ratingCount?Number((item.ratingTotal/item.ratingCount).toFixed(1)):null})).sort((a,b)=>b.responses-a.responses);
    if(format==="csv") {
      function csv(value) {
        const safe=String(value??"").replace(/[\r\n]/g," ");
        const escaped=/^[\s]*[=+@-]/.test(safe)?"'"+safe:safe;
        return '"'+escaped.replace(/"/g,'""')+'"';
      }
      const data=[["Workshop","Offering year","Responses","Question","Answer","Count"]];
      for(const w of workshops)for(const q of FEEDBACK_QUESTIONS)
        for(const [answer,count] of Object.entries(w.answers[q.id]||{}))
          data.push([w.title,w.offeringYear,w.responses,q.label,answer,count]);
      return new Response(data.map(row=>row.map(csv).join(",")).join("\r\n"),{headers:{
        "Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="workshop-feedback.csv"',"Cache-Control":"private, no-store"
      }});
    }
    return Response.json({success:true,totalResponses:rows.length,questions:FEEDBACK_QUESTIONS,workshops},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return adminAccessResponse(error)||Response.json({message:"Feedback analysis unavailable."},{status:500});}
}
