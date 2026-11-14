// Required JS platform-interface tests: execute the actual built Obsidian plugin.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
class Element {
  children=[]; text=''; events={};
  createEl(tag,options={}) {const child=new Element();child.tag=tag;child.text=options.text??'';this.children.push(child);return child;}
  empty(){this.children=[];}
  addClass(){}
  addEventListener(type,handler){this.events[type]=handler;}
  all(){return this.children.flatMap(c=>[c,...c.all()]);}
}
const complete = count => ({schema:'viggobsidian.link-style-result.v1',status:'complete',report:{inventoried:3,checked:1,skipped_templates:0,findings:count,issues:Array.from({length:count},(_,i)=>({path:'folder/a.md',line:i+1,kind:'visible-link-path',old:'[[folder/b]]',new:'[[b]]'}))}});
function host(saved=null) {
  const notices=[];const requests=[];const workers=[];const savedWrites=[];let response=complete(1);const factories=new Map();let now=100;let settingTab;
  class TFile {constructor(path){this.path=path;this.extension='md';this.parent={path:path.split('/').slice(0,-1).join('/')};this.stat={mtime:1,ctime:1,size:10};}}
  class Plugin {async loadData(){return saved;}async saveData(value){savedWrites.push(value);}registerView(type,create){factories.set(type,create);}addSettingTab(tab){settingTab=tab;}addCommand(){} }
  class ItemView {constructor(leaf){this.leaf=leaf;this.contentEl=new Element();}}
  class MarkdownView {}
  class PluginSettingTab {constructor(app,plugin){this.app=app;this.plugin=plugin;}}
  const files=['folder/a.md','folder/b.md','outside.md'].map(p=>new TFile(p));const listeners=new Map();let reads=0;
  const vault={getMarkdownFiles:()=>files,read:async()=>{reads++;return '# Fictional note';},on:(name,callback)=>{const key={};listeners.set(key,callback);return key;},offref:key=>listeners.delete(key),getAbstractFileByPath:path=>files.find(f=>f.path===path)};
  let active=files[0];let leaves=[];
  const workspace={getActiveFile:()=>active,getLeavesOfType:type=>leaves.filter(leaf=>leaf.view.getViewType()===type),getLeaf:()=>({openFile:async file=>{active=file;}}),getRightLeaf:()=>({setViewState:async({type})=>{leaves.push({view:factories.get(type)({})});}}),revealLeaf:async()=>{}};
  class Worker {constructor(){workers.push(this);}postMessage(request){requests.push(request);if(response!==null)queueMicrotask(()=>{now+=7;this.onmessage?.({data:response});});}terminate(){this.terminated=true;}}
  const module={exports:{}};
  runInNewContext(readFileSync('main.js','utf8'),{module,exports:module.exports,require:id=>{assert.equal(id,'obsidian');return {getFrontMatterInfo:()=>({exists:false,frontmatter:'',contentStart:0}),parseYaml:()=>({}),Plugin,ItemView,MarkdownView,TFile,PluginSettingTab,Notice:class {constructor(message){notices.push(message);}}};},Worker,URL,Blob,atob,Uint8Array,AbortController,TextEncoder,performance:{now:()=>now},setTimeout,clearTimeout,queueMicrotask,fetch:()=>{throw Error('network prohibited');},console});
  const p=new module.exports.default();p.app={vault,workspace};p.openResults=async()=>{};
  return {p,files,notices,requests,workers,listeners,vault,get settingTab(){return settingTab;},savedWrites,get reads(){return reads;},change:()=>listeners.forEach(fn=>fn()),active:file=>{active=file;},response:value=>{response=value;},view:(type='viggobsidian-findings')=>{const view=factories.get(type)({});leaves=[{view}];return view;}};
}
function toggle(definition) {
  let change;
  definition.render({addToggle:add=>add({setValue(){return this;},onChange(fn){change=fn;return this;}})});
  return change;
}
test('opt-in gates scanning; note and recursive folder targets retain complete resolution inventory',async()=>{
  const h=host();await h.p.onload();await h.p.run('note');assert.equal(h.requests.length,0);
  h.p.workRules=true;await h.p.run('note');assert.deepEqual([...h.requests[0].snapshot.targets],['folder/a.md']);assert.equal(h.requests[0].snapshot.inventory.length,3);
  await h.p.run('folder');assert.deepEqual([...h.requests[1].snapshot.targets],['folder/a.md','folder/b.md']);
  await h.p.run('vault');assert.equal(h.requests[2].snapshot.targets,null);assert.equal(h.listeners.size,0);assert.ok(h.workers.every(w=>w.terminated));
});
test('malformed worker responses, mutation, cancellation and unload never preserve a completed result',async()=>{
  const h=host();await h.p.onload();h.p.workRules=true;await h.p.run('vault');assert.equal(h.p.result.status,'complete');
  h.response({status:'complete',report:{issues:[]}});await h.p.run('vault');assert.equal(h.p.result.status,'incomplete');
  h.response(null);const pending=h.p.run('vault');assert.equal(h.p.result,null);await new Promise(r=>setTimeout(r,0));h.change();h.p.controller.abort();await pending;assert.equal(h.p.result.status,'incomplete');assert.equal(h.listeners.size,0);
  const unloading=h.p.run('vault');await new Promise(r=>setTimeout(r,0));h.p.onunload();await unloading;assert.equal(h.p.result.status,'incomplete');assert.equal(h.listeners.size,0);assert.ok(h.workers.every(w=>w.terminated));
});
test('1000 findings render only 100 rows per page with an honest total and working page controls',async()=>{
  const h=host();await h.p.onload();h.p.result=complete(1000);const view=h.view();view.render();
  assert.equal(view.contentEl.all().filter(e=>e.tag==='li').length,100);assert.ok(view.contentEl.all().some(e=>e.text==='Showing findings 1–100 of 1000'));
  view.contentEl.all().find(e=>e.text==='Next 100').events.click();assert.equal(view.contentEl.all().filter(e=>e.tag==='li').length,100);assert.ok(view.contentEl.all().some(e=>e.text==='Showing findings 101–200 of 1000'));
  view.contentEl.all().find(e=>e.text==='Previous 100').events.click();assert.ok(view.contentEl.all().some(e=>e.text==='Showing findings 1–100 of 1000'));
  h.p.result={status:'incomplete',reason:'cancelled'};view.render();assert.equal(view.contentEl.all().filter(e=>e.tag==='li').length,0);
});
test('Wiki and Activity null pending results never render stale Work findings',async()=>{
  const h=host();await h.p.onload();h.p.result=complete(1);
  for (const mode of ['wiki','activity']) {h.p.mode=mode;h.p.wikiResult=null;h.p.activityResult=null;const view=h.view();view.render();assert.equal(view.contentEl.all().filter(e=>e.tag==='li').length,0,mode);assert.ok(!view.contentEl.all().some(e=>e.text.includes('folder/a.md:1')),mode);}
});
test('Activity actual plugin opt-in, capability boundary, view and unload retain honest outcomes',async()=>{
  const h=host();await h.p.onload();await h.p.runActivity();assert.equal(h.requests.length,0);
  h.p.activityProfile='numbered-v1';h.response({schema:'viggobsidian.activity-result.v1',status:'not_applicable',reason:'activity_contract_not_selected'});await h.p.runActivity();assert.equal(h.p.activityResult.status,'not_applicable');assert.equal(h.requests[0].snapshot.schema,'viggobsidian.activity-snapshot.v1');assert.deepEqual(Object.keys(h.requests[0].snapshot.metadata),[]);
  const finding={path:'folder/a.md',code:'strict-activity-provenance',message:'Example: invalid provenance'};
  const completeActivity={schema:'viggobsidian.activity-result.v1',status:'complete',capabilities:['activity-text.v1','provenance-v1','chat-v1','event-activity-v1.1','mail-delivery-v1'],report:{path:finding.path,findings:[finding]}};
  h.response(completeActivity);await h.p.runActivity();assert.match(h.p.status,/^Completed: 1 finding · \d+ ms$/);const view=h.view();view.render();assert.ok(view.contentEl.all().some(e=>e.text==='Activity text'));assert.ok(view.contentEl.all().some(e=>e.text===finding.message));assert.ok(view.contentEl.all().some(e=>e.text==='Text format only; authorship and completed actions are not verified.'));await h.p.navigateWiki(finding);
  h.response({...completeActivity,capabilities:[]});await h.p.runActivity();assert.equal(h.p.activityResult.status,'incomplete');
  h.response(null);const running=h.p.runActivity();await new Promise(resolve=>setTimeout(resolve,0));h.p.onunload();await running;assert.equal(h.p.activityResult.status,'incomplete');assert.equal(h.listeners.size,0);assert.ok(h.workers.every(w=>w.terminated));
});
test('Wiki opt-in, distinct outcomes, note-only navigation and unload use actual plugin boundary',async()=>{
  const h=host();await h.p.onload();await h.p.runWiki();assert.equal(h.requests.length,0);
  h.p.wikiProfile='numbered-v1';h.response({schema:'viggobsidian.wiki-layout-result.v1',status:'not_applicable',reason:'profile_or_classification_not_selected'});await h.p.runWiki();assert.equal(h.p.wikiResult.status,'not_applicable');assert.equal(h.requests[0].snapshot.schema,'viggobsidian.wiki-layout-snapshot.v2');assert.deepEqual([...h.requests[0].snapshot.cssclasses],[]);
  const finding={path:'folder/a.md',code:'wiki-preamble',message:'start Wiki with a title and the Back/Raw/Finder shortcuts'};
  h.response({schema:'viggobsidian.wiki-layout-result.v1',status:'complete',report:{path:finding.path,has_facts:false,findings:[finding]}});await h.p.runWiki();assert.equal(h.p.wikiResult.status,'complete');assert.match(h.p.status,/^Completed: 1 finding · \d+ ms$/);
  const view=h.view();view.render();const button=view.contentEl.all().find(e=>e.text==='folder/a.md — wiki-preamble');assert.ok(button);assert.ok(view.contentEl.all().some(e=>e.text===finding.message));assert.ok(!view.contentEl.all().some(e=>e.text.includes('folder/a.md:1')));await h.p.navigateWiki(finding);
});
test('overview is read-only, preserves active checks and findings, and shows verified declarations',async()=>{
 const h=host();await h.p.onload();h.p.workRules=true;h.p.wikiProfile='numbered-v1';const previous=complete(1);h.p.result=previous;const active=new AbortController();h.p.controller=active;
 await h.p.openOverview();assert.equal(h.p.result,previous);assert.equal(h.p.controller,active);assert.equal(active.signal.aborted,false);assert.equal(h.reads,0);assert.equal(h.requests.length,0);assert.equal(h.workers.length,0);
 const view=h.view('vigg-vault-overview');view.render();const text=view.contentEl.all().map(e=>e.text).join('\n');
 assert.match(text,/Work link style: enabled/);assert.match(text,/Wiki layout: numbered-v1/);assert.match(text,/Activity text: off/);assert.match(text,/Current note, current folder \(including subfolders\), and vault/);assert.match(text,/source-preparation-native: unavailable/);assert.match(text,/Pinned declarations verified, native connection not inspected/);assert.match(text,/fdabcccbdddfb3a77bb501925b42434f184cdfd1e4be213ee0fc0473f2773b2f/);
});
test('settings preserve unknown saved fields and all opt-ins',async()=>{
 const h=host({unknownSetting:'keep',activityProfile:'numbered-v1'});await h.p.onload();const definition=h.settingTab.getSettingDefinitions().find(item=>item.name==='Work link-style rules');await toggle(definition)(true);
 assert.deepEqual(JSON.parse(JSON.stringify(h.savedWrites[0])),{unknownSetting:'keep',activityProfile:'numbered-v1',workRules:true,wikiProfile:'none'});
});
test('fake clock records non-negative total timing for complete, exception, cancellation and unload',async()=>{
 const completed=host();await completed.p.onload();completed.p.workRules=true;completed.p.clock=(()=>{const values=[100,107];return()=>values.shift();})();await completed.p.run('note');assert.equal(completed.p.lastTiming.elapsedMs,7);
 const failed=host();await failed.p.onload();failed.p.workRules=true;failed.p.clock=(()=>{const values=[100,80];return()=>values.shift();})();failed.p.openResults=async()=>{throw Error('open failed');};await failed.p.run('note');assert.match(failed.p.status,/Incomplete: plugin or worker failed · 0 ms$/);assert.equal(failed.p.lastTiming.elapsedMs,0);
 const cancelled=host();await cancelled.p.onload();cancelled.p.workRules=true;cancelled.response(null);const cancelling=cancelled.p.run('note');await new Promise(resolve=>setTimeout(resolve,0));cancelled.p.controller.abort();await cancelling;assert.match(cancelled.p.status,/Incomplete: cancelled · \d+ ms$/);assert.equal(cancelled.p.lastTiming.kind,'Work link style');
 const unloaded=host();await unloaded.p.onload();unloaded.p.workRules=true;unloaded.response(null);const unloading=unloaded.p.run('note');await new Promise(resolve=>setTimeout(resolve,0));unloaded.p.onunload();await unloading;assert.equal(unloaded.p.lastTiming,null);assert.doesNotMatch(unloaded.p.status,/· \d+ ms$/);
});
