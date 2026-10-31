import { requireActiveStudent, studentAccessResponse } from "@/services/studentAccess";
import { cosmosNow, queryCosmosDocuments, readCosmosDocument, replaceCosmosDocument, createCosmosDocument, isCosmosConflict, isCosmosPreconditionFailed } from "@/services/cosmosData";
import { WORKSHOP_FEEDBACK_XP, FEEDBACK_QUESTIONS, validateWorkshopFeedback } from "@/services/workshopFeedback.mjs";
export const runtime = "nodejs";

const levels = [[1000,6,"Youth Champion"],[700,5,"Pathway Explorer"],[450,4,"Innovation Builder"],[250,3,"Future Creator"],[100,2,"Skill Starter"],[0,1,"New Explorer"]];
function getLevel(points) { const [,level,levelName] = levels.find(([min])=>points>=min); return {level,levelName}; }
function safeTask(registration) {
  return { id: registration.id, workshopId: registration.workshopId,
    title: registration.workshopSnapshot?.title || registration.workshopId,
    completedAt: registration.completedAt, feedback: registration.workshopFeedback || null,
    reward: WORKSHOP_FEEDBACK_XP,
  };
}
export async function GET(request) {
  try {
    const {uid}=await requireActiveStudent(request);
    const completed=await queryCosmosDocuments("registrations",
      "SELECT * FROM c WHERE c.studentId = @id AND c.status = 'completed' AND c.attendanceStatus = 'verified'",
      [{name:"@id",value:uid}]);
    const tasks=await Promise.all(completed.map(async registration => {
      const task=safeTask(registration);
      if(task.feedback) {
        const tx=await readCosmosDocument("xpTransactions",`${uid}_feedback_${registration.id}`);
        task.rewardStatus=tx?.status||"not_started";
      }
      return task;
    }));
    return Response.json({success:true,questions:FEEDBACK_QUESTIONS,tasks,pendingCount:tasks.filter(t=>!t.feedback||t.rewardStatus!=="completed").length}, {headers:{"Cache-Control":"private, no-store"}});
  } catch(error) {
    return studentAccessResponse(error) || Response.json({success:false,message:"Feedback tasks could not be loaded."},{status:500});
  }
}
export async function POST(request) {
  try {
    const {uid}=await requireActiveStudent(request);
    const body=await request.json().catch(()=>null);
    if(typeof body?.registrationId!=="string" || body.registrationId.length>128 ||
       !validateWorkshopFeedback(body.answers,body.comment)) {
      return Response.json({success:false,message:"Please answer all five questions. Comments are optional (maximum 500 characters)."},{status:400});
    }
    const registration=await readCosmosDocument("registrations",body.registrationId);
    if(!registration || registration.studentId!==uid) return Response.json({success:false,message:"Task not found."},{status:404});
    if(registration.status!=="completed" || registration.attendanceStatus!=="verified")
      return Response.json({success:false,message:"Feedback is available only after verified attendance."},{status:403});
    const transactionId=`${uid}_feedback_${registration.id}`;
    if(registration.workshopFeedback) {
      const existingReward=await readCosmosDocument("xpTransactions",transactionId);
      if(existingReward?.status==="completed") return Response.json({success:true,alreadyCompleted:true,message:"Thank you! Your 20 XP was already awarded."});
      if(existingReward) return Response.json({success:true,rewardPending:true,message:"Your feedback was saved. Your reward still needs verification."},{status:202});
    }

    // Save feedback only once with optimistic concurrency.
    if(!registration.workshopFeedback) {
      const feedback={answers:body.answers,comment:(body.comment||"").trim(),submittedAt:cosmosNow(),workshopTitle:registration.workshopSnapshot?.title||"",workshopCategory:registration.workshopSnapshot?.category||"General"};
      try {
        await replaceCosmosDocument("registrations",registration,{workshopFeedback:feedback,updatedAt:cosmosNow()});
      } catch(error) {
        if(isCosmosPreconditionFailed(error)) return Response.json({success:false,message:"This task changed. Please refresh."},{status:409});
        throw error;
      }
    }
    // A deterministic ledger prevents duplicate XP. 'processing' is never replayed
    // automatically: a Cosmos failure could occur after changing the student's balance.
    let reserved;
    try {
      reserved=await createCosmosDocument("xpTransactions",{
        id:transactionId, studentId:uid,workshopId:registration.workshopId,
        registrationId:registration.id,action:"workshop_feedback",points:WORKSHOP_FEEDBACK_XP,
        status:"processing",createdAt:cosmosNow(),updatedAt:cosmosNow(),
      });
    } catch(error) {
      if(isCosmosConflict(error)) return Response.json({success:true,alreadyCompleted:true,message:"Feedback saved. Your reward is being verified."});
      throw error;
    }
    try {
      let awarded=false;
      for(let attempt=0;attempt<3;attempt++) {
        const student=await readCosmosDocument("students",uid);
        if(!student) throw new Error("Student profile unavailable");
        const totalXp=(Number(student.totalXp)||0)+WORKSHOP_FEEDBACK_XP;
        try {
          await replaceCosmosDocument("students",student,{totalXp,...getLevel(totalXp),updatedAt:cosmosNow()});
          awarded=true; break;
        } catch(error) { if(!isCosmosPreconditionFailed(error)) throw error; }
      }
      if(!awarded) throw new Error("Concurrent student update");
      await replaceCosmosDocument("xpTransactions",reserved,{status:"completed",updatedAt:cosmosNow()});
      return Response.json({success:true,pointsAwarded:WORKSHOP_FEEDBACK_XP,message:"Thanks for helping improve our workshops! +20 XP earned."});
    } catch(error) {
      console.error("Feedback reward requires ledger review",transactionId,error);
      return Response.json({success:true,rewardPending:true,message:"Feedback saved. Your 20 XP reward needs review."},{status:202});
    }
  } catch(error) {
    return studentAccessResponse(error)||Response.json({success:false,message:"Feedback could not be saved. Please retry."},{status:500});
  }
}
