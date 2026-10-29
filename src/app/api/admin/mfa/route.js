import { NextResponse } from "next/server";
import { requireActiveAdmin, adminAccessResponse } from "@/services/adminAccess";
import { readCosmosDocument, replaceCosmosDocument, cosmosNow } from "@/services/cosmosData";
import { encryptSecret, decryptSecret, generateTotpSecret, verifyTotp, totpUri, makeMfaCookie, MFA_COOKIE, mfaCookieOptions, hashRecoveryCode } from "@/services/adminMfa";
import { randomBytes } from "node:crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
const errorReply=(err)=>adminAccessResponse(err) || reply({message:"Authenticator operation failed."},500);
export async function GET(request) {
 try {
  const admin=await requireActiveAdmin(request,{skipMfa:true});
  return reply({enabled:!!admin.adminData.mfa?.secret,verified:admin.mfaVerified,method:"authenticator"});
 }catch(e){return errorReply(e);}
}
export async function POST(request) {
 try {
  const admin=await requireActiveAdmin(request,{skipMfa:true});
  const body=await request.json();
  const action=body?.action;
  if(!["start","enroll","verify"].includes(action))return reply({message:"Invalid operation."},400);
  let current=await readCosmosDocument("admins",admin.uid);
  const state=current.mfa || {};
  if(action==="start") {
   if(state.secret)return reply({message:"Authenticator is already enabled."},409);
   const secret=generateTotpSecret();
   await replaceCosmosDocument("admins",current,{mfa:{...state,pending:encryptSecret(secret),pendingExpires:Date.now()+600000},updatedAt:cosmosNow()});
   return reply({uri:totpUri(secret,admin.email),manualKey:secret.match(/.{1,4}/g).join(" ")});
  }
  const code=String(body.code||"").replaceAll(" ","");
  const recovery=action==="verify" && /^[a-fA-F0-9]{16}$/.test(code.replaceAll("-",""));
  if(!recovery && !/^\d{6}$/.test(code))return reply({message:"Enter a six-digit code or recovery code."},400);
  if((state.lockUntil||0)>Date.now())return reply({message:"Too many attempts. Try again later."},429);
  const enrolling=action==="enroll";
  if(enrolling && (state.secret||!state.pending||state.pendingExpires<Date.now()))return reply({message:"Setup expired or already enabled. Start again."},409);
  if(!enrolling&&!state.secret)return reply({message:"Enroll your authenticator first."},409);
  const secret=decryptSecret(enrolling?state.pending:state.secret);
  const recoveryHash=recovery?hashRecoveryCode(code):null;
  const recoveryIndex=recovery?(state.recoveryHashes||[]).indexOf(recoveryHash):-1;
  const step=recoveryIndex>=0?(state.lastStep??-1)+1:verifyTotp(secret,code);
  if(step<0||(!enrolling && step<=(state.lastStep??-1))) {
   const failures=(state.failures||0)+1;
   await replaceCosmosDocument("admins",current,{mfa:{...state,failures:failures>=5?0:failures,lockUntil:failures>=5?Date.now()+300000:0}});
   return reply({message:"Invalid or already used verification code."},401);
  }
  const version=enrolling?randomBytes(12).toString("hex"):state.version;
  let recoveryCodes;
  const next={...state,failures:0,lockUntil:0,lastStep:step};
  if(recoveryIndex>=0)next.recoveryHashes=state.recoveryHashes.filter((_,i)=>i!==recoveryIndex);
  if(enrolling){
    recoveryCodes=Array.from({length:8},()=>randomBytes(8).toString("hex").toUpperCase());
    next.secret=state.pending;next.version=version;next.recoveryHashes=recoveryCodes.map(hashRecoveryCode);
    delete next.pending;delete next.pendingExpires;
  }
  await replaceCosmosDocument("admins",current,{mfa:next,updatedAt:cosmosNow()});
  const response=reply({success:true,enabled:true,...(recoveryCodes?{recoveryCodes}:{})});
  response.cookies.set(MFA_COOKIE,makeMfaCookie(admin.uid,admin.authTime,version),mfaCookieOptions);
  return response;
 }catch(e){console.error("Admin MFA operation:",e?.message);return errorReply(e);}
}
