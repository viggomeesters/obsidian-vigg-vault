// Required platform interface tests. Injected metadata fixtures model host API output;
// real Obsidian metadata semantics are checked separately in the designated vault.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker as NodeWorker} from 'node:worker_threads';
import {validateWikiNote,wikiOutcome} from '../src/wiki-adapter.mjs';
const wasmBytes=readFileSync('vendor/wasm/wiki_layout_core.wasm');
function setup(path='d/wiki/nested/wiki.md') {
  const listeners=new Map();const workers=[];
  const file={path,stat:{mtime:1,ctime:1,size:50}};
  const vault={read:async()=> '---\nmetadata fixture\n---\n# Example\r\n',on:(name,fn)=>{const token={};listeners.set(token,fn);return token;},offref:t=>listeners.delete(t)};
  const options={profile:'numbered-v1',getFrontMatterInfo:()=>({exists:true,frontmatter:'metadata fixture',contentStart:25}),parseYaml:()=>({cssclasses:[]}),createWorker:()=>{
    const url=new URL('../src/wiki-worker.mjs',import.meta.url).href;
    const node=new NodeWorker(`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:data=>parentPort.postMessage(data)};await import(${JSON.stringify(url)});parentPort.on('message',data=>self.onmessage({data}));`,{eval:true});
    const facade={postMessage:data=>node.postMessage(data),terminate:()=>{facade.terminated=true;node.terminate();}};
    node.on('message',data=>facade.onmessage?.({data}));node.on('error',()=>facade.onerror?.());workers.push(facade);return facade;
  }};
  return {file,vault,listeners,workers,options,run:()=>validateWikiNote(vault,file,wasmBytes,options),change:()=>listeners.forEach(fn=>fn())};
}
test('actual Wiki Worker selects native targets, not ordinary or layer-only notes',async()=>{
  for(const [path,metadata,status] of [['d/wiki/nested/wiki.md',{},'complete'],['d/note.md',{layer:'wiki'},'not_applicable'],['d/note.md',{cssclasses:['vault-wiki-direct']},'complete'],['d/wiki/note.md',{},'not_applicable']]) {
    const h=setup(path);h.options.parseYaml=()=>metadata;const result=await h.run();assert.equal(result.status,status);if(status==='complete'){assert.equal(result.report.path,path);assert.equal(result.report.findings[0].code,'wiki-preamble');assert.equal(result.report.findings[0].message,'start Wiki with a title and the Back/Raw/Finder shortcuts');assert.ok(!('line' in result.report.findings[0]));}assert.equal(h.listeners.size,0);assert.ok(h.workers.every(w=>w.terminated));
  }
  const h=setup();h.options.profile='future';assert.equal((await h.run()).status,'not_applicable');
});
test('capture takes body and metadata from same read; malformed host metadata cannot be clean',async()=>{
  const h=setup();let parsed;h.options.parseYaml=value=>{parsed=value;return {};};await h.run();assert.equal(parsed,'metadata fixture');
  for(const info of [null,{exists:true,contentStart:-1},{exists:true,contentStart:999},{exists:true,contentStart:0,frontmatter:1}]) {const h=setup();h.options.getFrontMatterInfo=()=>info;assert.equal((await h.run()).status,'incomplete');}
  for(const metadata of [null,[],{cssclasses:'vault-wiki-direct'},{cssclasses:[1]}]) {const h=setup();h.options.parseYaml=()=>metadata;assert.equal((await h.run()).status,'incomplete');}
  const malformed=setup();malformed.options.getFrontMatterInfo=()=>({exists:true,frontmatter:'bad',contentStart:0});malformed.options.parseYaml=()=>{throw Error('YAML failure');};assert.equal((await malformed.run()).status,'incomplete');
});
test('cancel, timeout, read failure, worker failure and drift release resources and reject completion',async()=>{
  for(const kind of ['cancel','timeout','read','worker','drift']) {
    const h=setup();h.options.timeoutMs=5;
    if(kind==='read')h.vault.read=async()=>{throw Error('read');};
    if(kind==='worker')h.options.createWorker=()=>({postMessage(){this.onerror();},terminate(){}});
    if(kind==='timeout')h.vault.read=()=>new Promise(()=>{});
    if(kind==='drift')h.vault.read=async()=>{h.file.stat.mtime++;return '# Changed';};
    const controller=new AbortController();h.options.signal=controller.signal;const pending=h.run();if(kind==='cancel')controller.abort();
    const result=await pending;assert.equal(result.status,'incomplete',kind);assert.equal(h.listeners.size,0,kind);assert.ok(h.workers.every(w=>w.terminated),kind);
  }
  const h=setup();let finish;h.vault.read=()=>new Promise(r=>{finish=r;});h.options.timeoutMs=2;assert.equal((await h.run()).status,'incomplete');finish('# Late');await new Promise(r=>setTimeout(r,5));assert.equal(h.workers.length,0,'late read created worker after cleanup');
});
test('defensive result boundary rejects fabricated locations, wrong paths and malformed reports',()=>{
  const path='d/wiki/wiki.md';const base={schema:'viggobsidian.wiki-layout-result.v1',status:'complete',report:{path,has_facts:false,findings:[{path,code:'wiki-preamble',message:'Message'}]}};
  assert.equal(wikiOutcome(base,path).status,'complete');
  for(const value of [null,{...base,schema:'future'},{...base,report:{...base.report,path:'elsewhere.md'}},{...base,report:{...base.report,has_facts:1}},{...base,report:{...base.report,findings:[{...base.report.findings[0],line:1}]}},{...base,report:{...base.report,findings:[{...base.report.findings[0],severity:'error'}]}}])assert.equal(wikiOutcome(value,path).status,'incomplete');
});
