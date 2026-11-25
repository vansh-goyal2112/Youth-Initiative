import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const origin=process.argv[2];
let target;
for(let i=0;i<30&&!target;i++){
 try{target=(await (await fetch('http://127.0.0.1:9222/json/list')).json()).find(t=>t.type==='page')}catch{}
 if(!target)await delay(500);
}
assert.ok(target,'Chrome CDP did not start');
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
let id=0;
const pending=new Map();
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id)pending.get(m.id)?.(m)};
function c(method,params={}){
 return new Promise((resolve,reject)=>{
  const key=++id;
  const timer=setTimeout(()=>{pending.delete(key);reject(new Error('CDP timeout '+method))},15000);
  pending.set(key,({result,error})=>{clearTimeout(timer);pending.delete(key); error?reject(new Error(error.message)):resolve(result)});
  ws.send(JSON.stringify({id:key,method,params}));
 });
}
try{
 await c('Network.enable');
 await c('Network.setCacheDisabled',{cacheDisabled:true});
 await c('Page.enable');
 await c('Page.navigate',{url:origin+'/login'});
 const evaluate=async expression=>(await c('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result.value;
 for(let i=0;i<30;i++){
  if(await evaluate('location.origin')===origin)break;
  await delay(500);
 }
 assert.equal(await evaluate('location.origin'),origin);
 const net={latency:150,downloadThroughput:1250000,uploadThroughput:1250000};
 await c('Network.emulateNetworkConditions',{offline:false,...net});
 const routes=['/api/workshops','/api/workshops/qa-workshop-001','/api/student/profile'];
 const run=route=>evaluate(`(async()=>{const start=performance.now();try{const r=await fetch(${JSON.stringify(route)},{cache:'no-store',headers:{Authorization:'Bearer fixture-student-a','X-Firebase-AppCheck':'fixture-app'}});const b=await r.json();return {status:r.status,success:b.success===true,ms:Math.round((performance.now()-start)*100)/100}}catch(e){return {status:0,success:false,error:e.message,ms:performance.now()-start}}})()`);
 const rows=[];
 for(let i=0;i<30;i++){const route=routes[i%3];rows.push({route,...await run(route)});}
 await c('Network.emulateNetworkConditions',{offline:true,...net});
 const offline=await run(routes[0]);
 await c('Network.emulateNetworkConditions',{offline:false,...net});
 const recovered=await run(routes[0]);
 const sorted=rows.map(r=>r.ms).sort((a,b)=>a-b);
 const p95=sorted[Math.ceil(.95*rows.length)-1];
 const failures=rows.filter(r=>r.status!==200||!r.success).length;
 console.log(JSON.stringify({scope:'Chrome with synthetic auth and in-memory data; offline check at fetch boundary, HTTP internal Docker origin',network:net,rows,p95,failures,offline,recovered},null,2));
 assert.ok(p95<3000 && failures/rows.length<.02 && offline.status===0 && recovered.success);
}finally{ws.close()}
