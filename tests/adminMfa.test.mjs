import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { generateTotpSecret, encryptSecret, decryptSecret, verifyTotp, totpUri, makeMfaCookie, isMfaCookieValid, hashRecoveryCode } from "../src/services/adminMfa.js";
process.env.ADMIN_MFA_ENCRYPTION_KEY = "12".repeat(32);
function otp(secret, now) {
 const step = Math.floor(now / 30000);
 const msg=Buffer.alloc(8);msg.writeBigUInt64BE(BigInt(step));
 const hash=createHmac("sha1",Buffer.from(secret,"hex")).update(msg).digest();
 return String((hash.readUInt32BE(hash[19]&15)&0x7fffffff)%1000000).padStart(6,"0");
}
test("MFA secret is encrypted at rest",()=>{
 const secret=generateTotpSecret();
 const cipher=encryptSecret(secret);
 assert.notEqual(cipher,secret);
 assert.equal(decryptSecret(cipher),secret);
});
test("TOTP verifies generated codes and rejects invalid values",()=>{
 const secret=generateTotpSecret(), now=Date.now(),code=otp(secret,now);
 assert.ok(verifyTotp(secret,code,now)>=0);
 assert.equal(verifyTotp(secret,"ABCDEFG",now),-1);
 assert.match(totpUri(secret,"admin@sait.ca"),/^otpauth:\/\/totp\//);
});
test("MFA cookie is signed and bound to uid, login time and version",()=>{
 const cookie=makeMfaCookie("user-1",12345,"version-1");
 const req=(v)=>({headers:{get:(header)=>header==="cookie"?"yi_admin_mfa="+v:null}});
 assert.equal(isMfaCookieValid(req(cookie),"user-1",12345,"version-1"),true);
 assert.equal(isMfaCookieValid(req(cookie),"user-2",12345,"version-1"),false);
 assert.equal(isMfaCookieValid(req(cookie),"user-1",12346,"version-1"),false);
 assert.equal(isMfaCookieValid(req(cookie),"user-1",12345,"version-2"),false);
 assert.equal(isMfaCookieValid(req(cookie+"garbage"),"user-1",12345,"version-1"),false);
});
test("Recovery code normalization is stable",()=>{
 assert.equal(hashRecoveryCode("aabb-ccdd"),hashRecoveryCode("AABBCCDD"));
});
