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
function host() {
  const notices=[];const requests=[];const workers=[];let response=complete(1);let factory;
  class TFile {constructor(path){this.path=path;this.extension='md';this.parent={path:path.split('/').slice(0,-1).join('/')};this.stat={mtime:1,ctime:1,size:10};}}
  class Plugin {async loadData(){return null;}registerView(type,create){factory=create;}addSettingTab(){}addCommand(){} }
  class ItemView {constructor(leaf){this.leaf=leaf;this.contentEl=new Element();}}
  class MarkdownView {}
  const files=['folder/a.md','folder/b.md','outside.md'].map(p=>new TFile(p));const listeners=new Map();
  const vault={getMarkdownFiles:()=>files,read:async()=> '# Fictional note',on:(name,callback)=>{const key={};listeners.set(key,callback);return key;},offref:key=>listeners.delete(key),getAbstractFileByPath:path=>files.find(f=>f.path===path)};
  let active=files[0];let leaves=[];
  const workspace={getActiveFile:()=>active,getLeavesOfType:()=>leaves,getLeaf:()=>({openFile:async file=>{active=file;}})};
  class Worker {
    constructor(){workers.push(this);}
    postMessage(request){requests.push(request);if(response!==null)queueMicrotask(()=>this.onmessage?.({data:response}));}
    terminate(){this.terminated=true;}
  }
  const module={exports:{}};
  runInNewContext(readFileSync('main.js','utf8'),{module,exports:module.exports,require:id=>{assert.equal(id,'obsidian');return {getFrontMatterInfo:()=>({exists:false,frontmatter:'',contentStart:0}),parseYaml:()=>({}),Plugin,ItemView,MarkdownView,TFile,PluginSettingTab:class {},Notice:class {constructor(message){notices.push(message);}}};},Worker,URL,Blob,atob,Uint8Array,AbortController,TextEncoder,performance,setTimeout,clearTimeout,queueMicrotask,console});
  const p=new module.exports.default();p.app={vault,workspace};p.openResults=async()=>{};
  return {p,files,notices,requests,workers,listeners,vault,change:()=>listeners.forEach(fn=>fn()),active:file=>{active=file;},response:value=>{response=value;},view:()=>{const view=factory({});leaves=[{view}];return view;}};
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

test('Wiki opt-in, distinct outcomes, note-only navigation and unload use actual plugin boundary',async()=>{
  const h=host();await h.p.onload();await h.p.runWiki();assert.equal(h.requests.length,0);
  h.p.wikiProfile='numbered-v1';
  h.response({schema:'viggobsidian.wiki-layout-result.v1',status:'not_applicable',reason:'profile_or_classification_not_selected'});await h.p.runWiki();assert.equal(h.p.wikiResult.status,'not_applicable');assert.equal(h.requests[0].snapshot.schema,'viggobsidian.wiki-layout-snapshot.v2');assert.deepEqual([...h.requests[0].snapshot.cssclasses],[]);
  const finding={path:'folder/a.md',code:'wiki-preamble',message:'start Wiki with a title and the Back/Raw/Finder shortcuts'};
  h.response({schema:'viggobsidian.wiki-layout-result.v1',status:'complete',report:{path:finding.path,has_facts:false,findings:[finding]}});await h.p.runWiki();assert.equal(h.p.wikiResult.status,'complete');assert.equal(h.p.status,'Completed: 1 finding');
  h.response({schema:'viggobsidian.wiki-layout-result.v1',status:'complete',report:{path:finding.path,has_facts:false,findings:[]}});await h.p.runWiki();assert.equal(h.p.status,'Completed: 0 findings');
  h.response({schema:'viggobsidian.wiki-layout-result.v1',status:'complete',report:{path:finding.path,has_facts:false,findings:[finding]}});await h.p.runWiki();
  const view=h.view();view.render();const button=view.contentEl.all().find(e=>e.text==='folder/a.md — wiki-preamble');assert.ok(button);assert.ok(view.contentEl.all().some(e=>e.text===finding.message));assert.ok(!view.contentEl.all().some(e=>e.text.includes('folder/a.md:1')));await h.p.navigateWiki(finding);
  h.response(null);const running=h.p.runWiki();await new Promise(r=>setTimeout(r,0));h.p.onunload();await running;assert.equal(h.p.wikiResult.status,'incomplete');assert.equal(h.listeners.size,0);assert.ok(h.workers.every(w=>w.terminated));
});
