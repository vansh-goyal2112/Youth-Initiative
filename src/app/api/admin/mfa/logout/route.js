import { NextResponse } from "next/server";
import { MFA_COOKIE } from "@/services/adminMfa";
export const runtime="nodejs";
export async function POST(){
 const response=NextResponse.json({success:true},{headers:{"Cache-Control":"no-store"}});
 response.cookies.set(MFA_COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/api/admin",maxAge:0});
 return response;
}
