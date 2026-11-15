import {ItemView, MarkdownView, Notice, Plugin, PluginSettingTab, TFile, WorkspaceLeaf, getFrontMatterInfo, parseYaml, type SettingDefinitionItem} from 'obsidian';
import {validateVaultSnapshot} from '../vendor/vault-adapter.mjs';

import {validateWikiNote} from './wiki-adapter.mjs';
import {validateActivityNote} from './activity-adapter.mjs';

interface WikiFinding {path:string;code:string;message:string}
type WikiOutcome = {status:'complete';report:{path:string;has_facts:boolean;findings:WikiFinding[]}} | {status:'incomplete'|'not_applicable';reason:string};
type ActivityOutcome = {status:'complete';report:{path:string;findings:WikiFinding[]}} | {status:'incomplete'|'not_applicable';reason:string};
const VIEW = 'viggobsidian-findings';
const OVERVIEW_VIEW = 'vigg-vault-overview';
type Scope = 'note' | 'folder' | 'vault';
interface Finding {path:string; line:number; kind:string; old:string; new:string}
interface Report {inventoried:number;checked:number;skipped_templates:number;findings:number;issues:Finding[]}
type Outcome = {status:'complete';report:Report} | {status:'incomplete';reason:string};
type Timing = {kind:'Work link style'|'Wiki layout'|'Activity text';elapsedMs:number};
type ProductOverview = {product:{id:string;name:string;version:string;minAppVersion:string};catalog:{revision:string;sha256:string};engines:Array<{id:string;label:string;revision:string;requestSchema:string;resultSchema:string;rulesets:string[];capabilities:string[];wasmSha256:string}>;unavailableCapabilities:Array<{id:string;status:string;surface:string;scope:string}>;jointCompatibility:{status:'verified-declarations';label:string}};
const overview = PRODUCT_OVERVIEW as ProductOverview;
function outcome(value:unknown):Outcome {
  if (!value || typeof value !== 'object') return {status:'incomplete',reason:'Invalid engine response'};
  const v = value as Record<string,unknown>;
  if (v.schema !== 'viggobsidian.link-style-result.v1') return {status:'incomplete',reason:'Unsupported engine response'};
  if (v.status === 'incomplete' && typeof v.reason === 'string') return {status:'incomplete',reason:v.reason};
  const r = v.report as Partial<Report> | undefined;
  if (v.status !== 'complete' || !r || !Array.isArray(r.issues) || !Number.isInteger(r.checked) || !Number.isInteger(r.inventoried) || !Number.isInteger(r.skipped_templates) || r.findings !== r.issues.length || !r.issues.every(i => typeof i.path === 'string' && Number.isInteger(i.line) && i.line > 0 && typeof i.kind === 'string' && typeof i.old === 'string' && typeof i.new === 'string')) return {status:'incomplete',reason:'Invalid engine report'};
  return {status:'complete',report:r as Report};
}

export default class ViggObsidian extends Plugin {
  workRules = false;
  wikiProfile = 'none';
  activityProfile = 'none';
  activityResult:ActivityOutcome|null = null;
  wikiResult:WikiOutcome|null = null;
  mode:'work'|'wiki'|'activity' = 'work';
  savedSettings:Record<string,unknown> = {};
  controller:AbortController|null = null;
  status = 'No check run';
  scope = '';
  result:Outcome|null = null;
  lastTiming:Timing|null = null;
  clock = () => performance.now();
  private disposed = false;
  async onload() {
    const saved:unknown = await this.loadData();
    this.savedSettings = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved as Record<string,unknown> : {};
    this.wikiProfile = typeof this.savedSettings.wikiProfile === 'string' ? this.savedSettings.wikiProfile : 'none';
    this.activityProfile = typeof this.savedSettings.activityProfile === 'string' ? this.savedSettings.activityProfile : 'none';
    this.workRules = !!saved && typeof saved === 'object' && (saved as {workRules?:unknown}).workRules === true;
    this.registerView(VIEW, leaf => new FindingsView(leaf,this));
    this.registerView(OVERVIEW_VIEW, leaf => new OverviewView(leaf,this));
    this.addSettingTab(new Settings(this.app,this));
    for (const scope of ['note','folder','vault'] as const) this.addCommand({id:`check-${scope}`,name:`Check ${scope === 'note' ? 'current note' : scope === 'folder' ? 'current folder' : 'vault'} link style`,callback:()=>this.run(scope)});
    this.addCommand({id:'check-wiki-note',name:'Check current note Wiki layout',callback:()=>this.runWiki()});
    this.addCommand({id:'check-activity-note',name:'Check current note Activity text',callback:()=>this.runActivity()});
    this.addCommand({id:'cancel-check',name:'Cancel check',callback:()=>this.controller?.abort()});
    this.addCommand({id:'show-findings',name:'Show findings',callback:()=>this.openResults()});
    this.addCommand({id:'show-capabilities-and-compatibility',name:'Show capabilities and compatibility',callback:()=>this.openOverview()});
  }
  onunload() { this.disposed = true; this.controller?.abort(); }
  private duration(kind:Timing['kind'],started:number) { const elapsedMs = Math.max(0,Math.round(this.clock() - started)); this.lastTiming = {kind,elapsedMs}; return ` · ${elapsedMs} ms`; }
  async openResults() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) { const right = this.app.workspace.getRightLeaf(false); if (!right) return; leaf = right; await leaf.setViewState({type:VIEW,active:false}); }
    await this.app.workspace.revealLeaf(leaf);
    this.refresh();
  }
  async openOverview() {
    let leaf = this.app.workspace.getLeavesOfType(OVERVIEW_VIEW)[0];
    if (!leaf) { const right = this.app.workspace.getRightLeaf(false); if (!right) return; leaf = right; await leaf.setViewState({type:OVERVIEW_VIEW,active:false}); }
    await this.app.workspace.revealLeaf(leaf);
    this.refreshOverview();
  }
  refresh() { for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) if (leaf.view instanceof FindingsView) leaf.view.render(); }
  refreshOverview() { for (const leaf of this.app.workspace.getLeavesOfType(OVERVIEW_VIEW)) if (leaf.view instanceof OverviewView) leaf.view.render(); }
  async run(scope:Scope) {
    if (this.controller) { new Notice('A link-style check is running'); return; }
    if (!this.workRules) { new Notice('Enable work link-style rules in settings before checking'); return; }
    const file = this.app.workspace.getActiveFile();
    if (scope !== 'vault' && (!file || file.extension !== 'md')) { new Notice('Open a Markdown note first'); return; }
    const started = this.clock();
    const folder = file?.parent?.path ?? '';
    const targets = scope === 'vault' ? null : scope === 'note' ? [file!.path] : this.app.vault.getMarkdownFiles().filter(f => folder === '' || f.path.startsWith(`${folder}/`)).map(f=>f.path);
    this.mode = 'work';this.scope = scope === 'vault' ? 'Vault' : scope === 'note' ? file!.path : `${folder || '/'} (including subfolders)`;this.result = null;this.status = 'Checking Work link style…';
    const controller = new AbortController();this.controller = controller;let url:string|undefined;
    try {
      await this.openResults();
      const bytes = Uint8Array.from(atob(WASM_BASE64), c=>c.charCodeAt(0));
      url = URL.createObjectURL(new Blob([WORKER_SOURCE],{type:'text/javascript'}));
      const workerUrl = url;
      const value = await validateVaultSnapshot(this.app.vault,bytes,{targets,signal:controller.signal,createWorker:()=>new Worker(workerUrl)});
      this.result = outcome(value);
      if (!this.disposed) this.status = (this.result.status === 'complete' ? `Completed: ${this.result.report.findings} ${this.result.report.findings===1?'finding':'findings'} in ${this.result.report.checked} ${this.result.report.checked===1?'note':'notes'}` : `Incomplete: ${this.result.reason}`) + this.duration('Work link style',started);
    } catch { this.result = {status:'incomplete',reason:'Plugin or worker failed'}; if (!this.disposed) this.status = 'Incomplete: plugin or worker failed' + this.duration('Work link style',started); }
    finally { if (url) URL.revokeObjectURL(url); this.controller = null; if (!this.disposed) this.refresh(); }
  }
  async runWiki() {
    if (this.controller) {new Notice('A check is running');return;}
    if (this.wikiProfile === 'none') {new Notice('Choose a Wiki profile in settings before checking');return;}
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') {new Notice('Open a Markdown note first');return;}
    const started = this.clock();
    this.mode = 'wiki';this.scope = file.path;this.wikiResult = null;this.status = 'Checking Wiki layout…';
    const controller = new AbortController();this.controller = controller;let url:string|undefined;
    try {
      await this.openResults();
      const bytes = Uint8Array.from(atob(WIKI_WASM_BASE64),c=>c.charCodeAt(0));
      url = URL.createObjectURL(new Blob([WIKI_WORKER_SOURCE],{type:'text/javascript'}));
      const workerUrl = url;
      this.wikiResult = await validateWikiNote(this.app.vault,file,bytes,{profile:this.wikiProfile,getFrontMatterInfo,parseYaml,signal:controller.signal,createWorker:()=>new Worker(workerUrl)}) as WikiOutcome;
      if (!this.disposed) this.status = (this.wikiResult.status === 'complete' ? `Completed: ${this.wikiResult.report.findings.length} ${this.wikiResult.report.findings.length === 1 ? 'finding' : 'findings'}` : this.wikiResult.status === 'not_applicable' ? 'Not applicable: profile or Wiki target not selected' : `Incomplete: ${this.wikiResult.reason}`) + this.duration('Wiki layout',started);
    } catch {this.wikiResult = {status:'incomplete',reason:'plugin_or_worker_failed'};if (!this.disposed) this.status = 'Incomplete: plugin or worker failed' + this.duration('Wiki layout',started);}
    finally {if(url)URL.revokeObjectURL(url);this.controller = null;if(!this.disposed)this.refresh();}
  }
  async runActivity() {
    if (this.controller) {new Notice('A check is running');return;}
    if (this.activityProfile === 'none') {new Notice('Choose an Activity profile in settings before checking');return;}
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') {new Notice('Open a Markdown note first');return;}
    const started = this.clock();
    this.mode = 'activity';this.scope = file.path;this.activityResult = null;this.status = 'Checking Activity text…';
    const controller = new AbortController();this.controller = controller;let url:string|undefined;
    try {
      await this.openResults();
      const bytes = Uint8Array.from(atob(ACTIVITY_WASM_BASE64),c=>c.charCodeAt(0));
      url = URL.createObjectURL(new Blob([ACTIVITY_WORKER_SOURCE],{type:'text/javascript'}));
      const workerUrl = url;
      this.activityResult = await validateActivityNote(this.app.vault,file,bytes,{profile:this.activityProfile,getFrontMatterInfo,parseYaml,signal:controller.signal,createWorker:()=>new Worker(workerUrl)}) as ActivityOutcome;
      if (!this.disposed) this.status = (this.activityResult.status === 'complete' ? `Completed: ${this.activityResult.report.findings.length} ${this.activityResult.report.findings.length === 1 ? 'finding' : 'findings'}` : this.activityResult.status === 'not_applicable' ? 'Not applicable: profile or Activity contract not selected' : `Incomplete: ${this.activityResult.reason}`) + this.duration('Activity text',started);
    } catch {this.activityResult = {status:'incomplete',reason:'plugin_or_worker_failed'};if (!this.disposed) this.status = 'Incomplete: plugin or worker failed' + this.duration('Activity text',started);}
    finally {if(url)URL.revokeObjectURL(url);this.controller = null;if(!this.disposed)this.refresh();}
  }
  async navigateWiki(finding:WikiFinding) {
    const file = this.app.vault.getAbstractFileByPath(finding.path);
    if (!(file instanceof TFile)) {new Notice('Note is no longer available; run the check again');return;}
    await this.app.workspace.getLeaf(false).openFile(file,{active:true});
  }
  async navigate(finding:Finding) {
    const file = this.app.vault.getAbstractFileByPath(finding.path);
    if (!(file instanceof TFile)) { new Notice('Note is no longer available; run the check again'); return; }
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file,{active:true});
    const view = leaf.view;
    if (view instanceof MarkdownView) { const line = Math.min(finding.line-1,view.editor.lineCount()-1); view.editor.setCursor({line,ch:0}); view.editor.scrollIntoView({from:{line,ch:0},to:{line,ch:0}},true); }
  }
}
class FindingsView extends ItemView {
  private page = 0;
  private shownResult:Outcome|null = null;
  constructor(leaf:WorkspaceLeaf,private plugin:ViggObsidian) {super(leaf);}
  getViewType(){return VIEW;}
  getDisplayText(){return 'ViggVault findings';}
  getIcon(){return 'list-checks';}
  async onOpen(){this.render();}
  render(){
    const el=this.contentEl; el.empty(); el.addClass('viggobsidian-findings');
    el.createEl('h2',{text:this.plugin.mode === 'activity' ? 'Activity text' : this.plugin.mode === 'wiki' ? 'Wiki layout' : 'Work link style'});
    el.createEl('p',{text:this.plugin.status,attr:{role:'status','aria-live':'polite'}});
    if (this.plugin.scope) el.createEl('p',{text:`Scope: ${this.plugin.scope}`});
    if(this.plugin.controller) el.createEl('button',{text:'Cancel check'}).addEventListener('click',()=>this.plugin.controller?.abort());
    if(this.plugin.mode === 'wiki' || this.plugin.mode === 'activity') {
      const result=this.plugin.mode === 'activity' ? this.plugin.activityResult : this.plugin.wikiResult;
      if(this.plugin.mode === 'activity' && result?.status === 'complete') el.createEl('p',{text:'Text format only; authorship and completed actions are not verified.'});
      if(result?.status === 'complete') {
        const list=el.createEl('ul');
        for(const issue of result.report.findings) {
          const row=list.createEl('li');
          row.createEl('button',{text:`${issue.path} — ${issue.code}`}).addEventListener('click',()=>{void this.plugin.navigateWiki(issue);});
          row.createEl('p',{text:issue.message});
        }
      }
      return;
    }
    const result=this.plugin.result;
    if(result?.status !== 'complete') return;
    if(this.shownResult !== result){this.page=0;this.shownResult=result;}
    el.createEl('p',{text:`${result.report.inventoried} notes in resolution inventory; ${result.report.skipped_templates} templates skipped.`});
    el.createEl('p',{text:'Only work link-style rules were checked. Results describe the captured snapshot.'});
    const start=this.page*100;
    const end=Math.min(start+100,result.report.issues.length);
    if(result.report.findings>0)el.createEl('p',{text:`Showing findings ${start+1}–${end} of ${result.report.findings}`});
    if(this.page>0)el.createEl('button',{text:'Previous 100'}).addEventListener('click',()=>{this.page--;this.render();});
    if(end<result.report.findings)el.createEl('button',{text:'Next 100'}).addEventListener('click',()=>{this.page++;this.render();});
    const list=el.createEl('ul');
    for(const issue of result.report.issues.slice(start,end)){
      const row=list.createEl('li');
      row.createEl('button',{text:`${issue.path}:${issue.line} — ${issue.kind}`}).addEventListener('click',()=>{void this.plugin.navigate(issue);});
      row.createEl('pre',{text:`${issue.old}\n→ ${issue.new}`});
    }
  }
}
class OverviewView extends ItemView {
  constructor(leaf:WorkspaceLeaf,private plugin:ViggObsidian) {super(leaf);}
  getViewType(){return OVERVIEW_VIEW;}
  getDisplayText(){return 'ViggVault capabilities';}
  getIcon(){return 'info';}
  async onOpen(){this.render();}
  render(){
    const el=this.contentEl; el.empty(); el.addClass('viggobsidian-findings');
    el.createEl('h2',{text:'Capabilities and compatibility'});
    el.createEl('p',{text:`${overview.product.name} ${overview.product.version}; minimum Obsidian ${overview.product.minAppVersion}.`});
    el.createEl('p',{text:overview.jointCompatibility.label});
    el.createEl('h3',{text:'Current opt-ins and supported scopes'});
    el.createEl('p',{text:`Work link style: ${this.plugin.workRules ? 'enabled' : 'off'} — Current note, current folder (including subfolders), and vault.`});
    el.createEl('p',{text:`Wiki layout: ${this.plugin.wikiProfile === 'none' ? 'off' : this.plugin.wikiProfile} — Current note only.`});
    el.createEl('p',{text:`Activity text: ${this.plugin.activityProfile === 'none' ? 'off' : this.plugin.activityProfile} — Current note only.`});
    const details=el.createEl('details');
    details.createEl('summary',{text:'Pinned engine revisions and hashes'});
    for (const engine of overview.engines) details.createEl('p',{text:`${engine.label}: revision ${engine.revision}; ${engine.requestSchema} → ${engine.resultSchema}; rulesets ${engine.rulesets.length ? engine.rulesets.join(', ') : 'none'}; WASM SHA-256 ${engine.wasmSha256}.`});
    details.createEl('p',{text:`Catalog revision ${overview.catalog.revision}; catalog SHA-256 ${overview.catalog.sha256}.`});
    el.createEl('h3',{text:'Not available in this plugin'});
    for (const capability of overview.unavailableCapabilities) el.createEl('p',{text:`${capability.id}: unavailable (${capability.surface}, ${capability.status}). ${capability.scope}`});
    el.createEl('p',{text:'This view reads no vault content, starts no Worker, changes no settings, and does not alter active checks or findings.'});
  }
}
class Settings extends PluginSettingTab {
  constructor(app:ViggObsidian['app'],private plugin:ViggObsidian){super(app,plugin);}
  getSettingDefinitions():SettingDefinitionItem[]{
    return [{name:'Capabilities and compatibility',desc:'Show current opt-ins, supported scopes and pinned declarations without scanning your vault.',render:setting=>{setting.addButton(button=>button.setButtonText('Show capabilities and compatibility').onClick(()=>void this.plugin.openOverview()));}}, {name:'Work link-style rules',desc:'Opt in to the work conventions: direct wikilinks, source labels and wiki metadata. These conventions can differ from your vault’s style. No notes are changed.',render:setting=>{setting.addToggle(toggle=>toggle.setValue(this.plugin.workRules).onChange(async value=>{
      try {await this.plugin.saveData({...this.plugin.savedSettings,workRules:value,wikiProfile:this.plugin.wikiProfile,activityProfile:this.plugin.activityProfile});this.plugin.savedSettings.workRules=value; this.plugin.workRules=value; if(!value)this.plugin.controller?.abort();}
      catch {toggle.setValue(this.plugin.workRules);new Notice('Could not save the rule selection');}
    }));}}, {name:'Wiki profile',desc:'Checks wiki.md beneath a wiki folder and notes with cssclasses: [vault-wiki-direct]. Does not check files or shortcut targets.',render:setting=>{setting.addDropdown(dropdown=>dropdown.addOption('none','Off').addOption('numbered-v1','Numbered-v1 · Wiki').setValue(this.plugin.wikiProfile).onChange(async value=>{
      try {await this.plugin.saveData({...this.plugin.savedSettings,workRules:this.plugin.workRules,wikiProfile:value,activityProfile:this.plugin.activityProfile});this.plugin.savedSettings.wikiProfile=value;this.plugin.wikiProfile=value;this.plugin.controller?.abort();}
      catch {dropdown.setValue(this.plugin.wikiProfile);new Notice('Could not save the rule selection');}
    }));}}, {name:'Activity profile',desc:'Checks chat-v1, provenance-v1, Event Note v1.1 Activity and marked mail deliveries. Author identity, completed actions and Event headers are not verified.',render:setting=>{setting.addDropdown(dropdown=>dropdown.addOption('none','Off').addOption('numbered-v1','Numbered-v1 · Activity').setValue(this.plugin.activityProfile).onChange(async value=>{
      try {await this.plugin.saveData({...this.plugin.savedSettings,workRules:this.plugin.workRules,wikiProfile:this.plugin.wikiProfile,activityProfile:value});this.plugin.savedSettings.activityProfile=value;this.plugin.activityProfile=value;this.plugin.controller?.abort();}
      catch {dropdown.setValue(this.plugin.activityProfile);new Notice('Could not save the rule selection');}
    }));}}];
  }
}
