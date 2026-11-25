import {registerHooks,createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd();
const XLSX=createRequire(path.join(root,'package.json'))('xlsx');
const stub={
 'adminAccess':'export const adminAccessResponse=()=>null;export const requireAdminPermission=async(_r,p)=>{if(p!=="workshops.import")throw Error(p);return {uid:"qa-admin"}};',
 'adminAudit':'export const describeAdminAudit=()=>{};export const withAdminAudit=fn=>fn;',
 'cosmosData':`export const fixtures=new Map(); export const cosmosNow=()=>new Date().toISOString();
 export const queryCosmosDocuments=async()=>[...fixtures.values()];
 export const readCosmosDocument=async(_,id)=>fixtures.get(id);
 export const createCosmosDocument=async(_,w)=>{if(fixtures.has(w.id))throw Error("duplicate");fixtures.set(w.id,structuredClone(w))};
 export const replaceCosmosDocument=async(_,old,next)=>fixtures.set(old.id,structuredClone(next));
 export const isCosmosConflict=()=>false;export const isCosmosPreconditionFailed=()=>false;`
};
registerHooks({resolve(spec,ctx,next){
 if(!spec.startsWith('@/'))return next(spec,ctx);
 const key=spec.split('/').at(-1);
 if(Object.hasOwn(stub,key))return {url:'data:text/javascript,'+encodeURIComponent(stub[key]),shortCircuit:true};
 let file=path.join(root,'src',spec.slice(2));
 if(!fs.existsSync(file))file+='.js';
 return next(pathToFileURL(file).href,ctx);
}});
const {POST}=await import(pathToFileURL(path.join(root,'src/app/api/admin/workshops/import/route.js')));
const {fixtures}=await import('data:text/javascript,'+encodeURIComponent(stub.cosmosData));
const original=Array.from({length:100},(_,i)=>({'Course Name':'QA Coding '+(i+1),'Program Area':'Digital Youth',Grade:'Grades 7 - 12','XP Reward':101+i}));
const book=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(original),'Import');
const bytes=XLSX.write(book,{type:'buffer',bookType:'xlsx'});
const parsed=XLSX.read(bytes,{type:'buffer'});
const rows=XLSX.utils.sheet_to_json(parsed.Sheets.Import).map(r=>({title:r['Course Name'],programArea:r['Program Area'],grade:r.Grade,xpReward:r['XP Reward'],offeringYear:'2026'}));
async function send(workshops){
 const start=performance.now();
 const response=await POST(new Request('http://qa-import.internal',{method:'POST',body:JSON.stringify({workshops,mode:'add'})}));
 return {status:response.status,ms:+(performance.now()-start).toFixed(2),body:await response.json(),stored:fixtures.size};
}
const first=await send(rows);assert.equal(first.status,200);assert.equal(first.body.importedCount,100);assert.equal(first.stored,100);
const retry=await send(rows);assert.equal(retry.status,200);assert.equal(retry.stored,100);
const dupe=await send([...rows,rows[0]]);assert.equal(dupe.status,400);assert.equal(dupe.stored,100);
assert.deepEqual([...fixtures.values()].map(w=>[w.title,w.xpReward,w.minGrade,w.maxGrade]),rows.map(x=>[x.title,x.xpReward,7,12]));
console.log(JSON.stringify({build:process.argv[2],scope:'Excel bytes and actual import handler; in-memory database and substituted admin and audit services',first,retry,dupe},null,2));
