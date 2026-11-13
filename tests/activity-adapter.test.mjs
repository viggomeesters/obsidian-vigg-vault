// Obsidian capture and real Worker platform tests. All text rules execute in Rust.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker as NodeWorker} from 'node:worker_threads';
import {validateActivityNote,activityOutcome} from '../src/activity-adapter.mjs';
const wasm=readFileSync('vendor/wasm/activity_core.wasm');
const corpus=JSON.parse(readFileSync('vendor/activity-core/fixtures/activity-legacy.json'));
function setup(){
 const listeners=new Map(),workers=[];const file={path:'example/event.md',stat:{mtime:1,ctime:1,size:100}};
 const vault={read:async()=>corpus.cases.find(c=>c.id==='human').body,on:(name,fn)=>{const token={};listeners.set(token,fn);return token;},offref:token=>listeners.delete(token)};
 const options={profile:'numbered-v1',getFrontMatterInfo:()=>({exists:true,frontmatter:'fixture',contentStart:0}),parseYaml:()=>({activity_contract:'provenance-v1'}),createWorker:()=>{
   const url=new URL('../src/activity-worker.mjs',import.meta.url).href;
   const node=new NodeWorker(`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:data=>parentPort.postMessage(data)};await import(${JSON.stringify(url)});parentPort.on('message',data=>self.onmessage({data}));`,{eval:true});
   const facade={postMessage:data=>node.postMessage(data),terminate:()=>{facade.terminated=true;node.terminate();}};node.on('message',data=>facade.onmessage?.({data}));node.on('error',()=>facade.onerror?.());workers.push(facade);return facade;
 }};
 return {file,vault,options,listeners,workers,run:()=>validateActivityNote(vault,file,wasm,options)};
}
test('Activity capture forwards only minimal metadata and actual Worker distinguishes skip/findings/clean',async()=>{
 for(const [metadata,status,count]of [[{activity_contract:'provenance-v1',privateIdentity:'do not send',providers:{secret:true}},'complete',0],[{},'not_applicable',null],[{activity_contract:'unknown'},'complete',1]]){
  const h=setup();h.options.parseYaml=()=>metadata;let captured;const factory=h.options.createWorker;h.options.createWorker=()=>{const worker=factory();const post=worker.postMessage;worker.postMessage=value=>{captured=value;post(value);};return worker;};
  const result=await h.run();assert.equal(result.status,status);if(count!==null)assert.equal(result.report.findings.length,count);assert.equal(captured.snapshot.metadata.privateIdentity,undefined);assert.equal(captured.snapshot.metadata.providers,undefined);assert.equal(h.listeners.size,0);assert.ok(h.workers.every(w=>w.terminated));
 }
 const h=setup();h.options.getFrontMatterInfo=()=>({exists:false,contentStart:0});assert.equal((await h.run()).status,'incomplete');
});
test('Activity malformed frontmatter, capture errors, cancellation, drift and Worker errors cannot complete',async()=>{
 for(const kind of ['yaml','boundary','unterminated','read','cancel','drift','worker','limit']){
  const h=setup();const controller=new AbortController();h.options.signal=controller.signal;
  if(kind==='yaml')h.options.parseYaml=()=>{throw Error('bad YAML');};
  if(kind==='boundary')h.options.getFrontMatterInfo=()=>({exists:true,contentStart:-1});
  if(kind==='unterminated')h.options.getFrontMatterInfo=text=>({exists:text.endsWith('\n---\n'),contentStart:0});
  if(kind==='read')h.vault.read=async()=>{throw Error('read');};
  if(kind==='drift')h.vault.read=async()=>{h.file.stat.mtime++;return '# Changed';};
  if(kind==='worker')h.options.createWorker=()=>({postMessage(){this.onerror();},terminate(){}});
  if(kind==='limit')h.file.stat.size=1024*1024+1;
  const pending=h.run();if(kind==='cancel')controller.abort();assert.equal((await pending).status,'incomplete',kind);assert.equal(h.listeners.size,0);assert.ok(h.workers.every(w=>w.terminated));
 }
});
test('Activity real Worker timeout terminates near-limit adversarial input and late reads create no Worker',async()=>{
 const h=setup();const body='## Activity\n\n> [!activity-day|2026-11-11] 11 Nov 2026\n\n'+'> [!activity-message|human] Alex\n> Text\n>\n> *12:00 · Alex · Chat*\n\n'.repeat(14000);assert.ok(Buffer.byteLength(body)<1024*1024);h.vault.read=async()=>body;h.options.timeoutMs=40;const result=await h.run();assert.equal(result.status,'incomplete');assert.equal(result.reason,'timeout');assert.equal(h.workers.length,1);assert.ok(h.workers[0].terminated);assert.equal(h.listeners.size,0);
 const late=setup();let finish;late.vault.read=()=>new Promise(resolve=>{finish=resolve;});late.options.timeoutMs=5;assert.equal((await late.run()).status,'incomplete');finish('# Late');await new Promise(resolve=>setTimeout(resolve,10));assert.equal(late.workers.length,0);
});
test('Activity rejects missing capabilities, invented locations and wrong paths',()=>{
 const path='example/event.md';const base={schema:'viggobsidian.activity-result.v1',status:'complete',capabilities:['activity-text.v1','provenance-v1','chat-v1','event-activity-v1.1','mail-delivery-v1'],report:{path,findings:[{path,code:'example',message:'Example'}]}};
 assert.equal(activityOutcome(base,path).status,'complete');for(const value of [null,{...base,schema:'future'},{...base,capabilities:[]},{...base,report:{...base.report,path:'other.md'}},{...base,report:{...base.report,findings:[{...base.report.findings[0],line:1}]}}])assert.equal(activityOutcome(value,path).status,'incomplete');
});
