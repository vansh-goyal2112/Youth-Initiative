import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
const COOKIE = "yi_admin_mfa";
const key = () => {
 const raw = process.env.ADMIN_MFA_ENCRYPTION_KEY;
 if (!raw || !/^[a-fA-F0-9]{64}$/.test(raw)) throw new Error("ADMIN_MFA_ENCRYPTION_KEY must be 64 hex characters (32 bytes).");
 return Buffer.from(raw, "hex");
};
const b64 = value => Buffer.from(value).toString("base64url");
const unb64 = value => Buffer.from(value, "base64url");
export const generateTotpSecret = () => randomBytes(20).toString("hex");
export function encryptSecret(secret) {
 const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
 const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
 return [b64(iv), b64(cipher.getAuthTag()), b64(encrypted)].join(".");
}
export function decryptSecret(value) {
 const [iv, tag, data] = String(value || "").split(".");
 if (!iv || !tag || !data) throw new Error("Invalid encrypted MFA secret.");
 const decipher = createDecipheriv("aes-256-gcm", key(), unb64(iv));
 decipher.setAuthTag(unb64(tag));
 return Buffer.concat([decipher.update(unb64(data)), decipher.final()]).toString("utf8");
}
export function verifyTotp(secret, code, now = Date.now()) {
 if (!/^\\d{6}$/.test(String(code || ""))) return -1;
 for (let offset = -1; offset <= 1; offset++) {
  const step = Math.floor(now / 30000) + offset;
  const message = Buffer.alloc(8); message.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", Buffer.from(secret, "hex")).update(message).digest();
  const index = digest[digest.length - 1] & 15;
  const number = (digest.readUInt32BE(index) & 0x7fffffff) % 1000000;
  const candidate = String(number).padStart(6, "0");
  if (timingSafeEqual(Buffer.from(candidate), Buffer.from(String(code)))) return step;
 }
 return -1;
}
export function totpUri(secret, email) {
 const label = encodeURIComponent("SAIT Youth Initiative Admin:" + email);
 return "otpauth://totp/" + label + "?secret=" + base32(Buffer.from(secret,"hex")) + "&issuer=" + encodeURIComponent("SAIT Youth Initiative Admin") + "&algorithm=SHA1&digits=6&period=30";
}
function base32(input) { const abc="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits=0, value=0, out=""; for (const b of input) {value=(value<<8)|b;bits+=8;while(bits>=5){out+=abc[(value>>>(bits-5))&31];bits-=5;}} if(bits)out+=abc[(value<<(5-bits))&31];return out; }
function signature(payload) {return b64(createHmac("sha256",key()).update(payload).digest());}
export function makeMfaCookie(uid, authTime, version) {
 const payload=b64(JSON.stringify({uid,at:authTime,v:version,exp:Date.now()+12*60*60*1000}));
 return payload+"."+signature(payload);
}
export function isMfaCookieValid(request, uid, authTime, version) {
 const value = request.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);
 if(!value)return false;
 const [payload,sig]=value.split(".");
 if(!payload||!sig)return false;
 const expected=signature(payload);
 if(sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;
 try {const d=JSON.parse(unb64(payload).toString("utf8"));return d.uid===uid&&d.at===authTime&&d.v===version&&Number.isFinite(d.exp)&&d.exp>Date.now();}catch{return false;}
}
export const MFA_COOKIE=COOKIE;
export const mfaCookieOptions = {httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",path:"/api/admin",maxAge:43200};
export function hashRecoveryCode(value){return createHash("sha256").update(key()).update(String(value).trim().toUpperCase().replaceAll("-","")).digest("hex");}
