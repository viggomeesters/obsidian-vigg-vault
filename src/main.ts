import {ItemView, MarkdownView, Notice, Plugin, PluginSettingTab, TFile, WorkspaceLeaf, getFrontMatterInfo, parseYaml, type SettingDefinitionItem} from 'obsidian';
import {validateVaultSnapshot} from '../vendor/vault-adapter.mjs';

import {validateWikiNote} from './wiki-adapter.mjs';

interface WikiFinding {path:string;code:string;message:string}
type WikiOutcome = {status:'complete';report:{path:string;has_facts:boolean;findings:WikiFinding[]}} | {status:'incomplete'|'not_applicable';reason:string};
const VIEW = 'viggobsidian-findings';
type Scope = 'note' | 'folder' | 'vault';
interface Finding {path:string; line:number; kind:string; old:string; new:string}
interface Report {inventoried:number;checked:number;skipped_templates:number;findings:number;issues:Finding[]}
type Outcome = {status:'complete';report:Report} | {status:'incomplete';reason:string};
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
  wikiResult:WikiOutcome|null = null;
  mode:'work'|'wiki' = 'work';
  savedSettings:Record<string,unknown> = {};
  controller:AbortController|null = null;
  status = 'No check run';
  scope = '';
  result:Outcome|null = null;
  private disposed = false;
  async onload() {
    const saved:unknown = await this.loadData();
    this.savedSettings = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved as Record<string,unknown> : {};
    this.wikiProfile = typeof this.savedSettings.wikiProfile === 'string' ? this.savedSettings.wikiProfile : 'none';
    this.workRules = !!saved && typeof saved === 'object' && (saved as {workRules?:unknown}).workRules === true;
    this.registerView(VIEW, leaf => new FindingsView(leaf,this));
    this.addSettingTab(new Settings(this.app,this));
    for (const scope of ['note','folder','vault'] as const) this.addCommand({id:`check-${scope}`,name:`Check ${scope === 'note' ? 'current note' : scope === 'folder' ? 'current folder' : 'vault'} link style`,callback:()=>this.run(scope)});
    this.addCommand({id:'check-wiki-note',name:'Check current note Wiki layout',callback:()=>this.runWiki()});
    this.addCommand({id:'cancel-check',name:'Cancel check',callback:()=>this.controller?.abort()});
    this.addCommand({id:'show-findings',name:'Show findings',callback:()=>this.openResults()});
  }
  onunload() { this.disposed = true; this.controller?.abort(); }
  async openResults() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) { const right = this.app.workspace.getRightLeaf(false); if (!right) return; leaf = right; await leaf.setViewState({type:VIEW,active:false}); }
    await this.app.workspace.revealLeaf(leaf);
    this.refresh();
  }
  refresh() { for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) if (leaf.view instanceof FindingsView) leaf.view.render(); }
  async run(scope:Scope) {
    if (this.controller) { new Notice('A link-style check is running'); return; }
    if (!this.workRules) { new Notice('Enable work link-style rules in settings before checking'); return; }
    const file = this.app.workspace.getActiveFile();
    if (scope !== 'vault' && (!file || file.extension !== 'md')) { new Notice('Open a Markdown note first'); return; }
    const folder = file?.parent?.path ?? '';
    const targets = scope === 'vault' ? null : scope === 'note' ? [file!.path] : this.app.vault.getMarkdownFiles().filter(f => folder === '' || f.path.startsWith(`${folder}/`)).map(f=>f.path);
    this.mode = 'work';
    this.scope = scope === 'vault' ? 'Vault' : scope === 'note' ? file!.path : `${folder || '/'} (including subfolders)`;
    this.result = null;
    this.status = 'Checking Work link style…';
    const controller = new AbortController();
    this.controller = controller;
    let url:string|undefined;
    try {
      await this.openResults();
      const bytes = Uint8Array.from(atob(WASM_BASE64), c=>c.charCodeAt(0));
      url = URL.createObjectURL(new Blob([WORKER_SOURCE],{type:'text/javascript'}));
      const workerUrl = url;
      const value = await validateVaultSnapshot(this.app.vault,bytes,{targets,signal:controller.signal,createWorker:()=>new Worker(workerUrl)});
      this.result = outcome(value);
      this.status = this.result.status === 'complete' ? `Completed: ${this.result.report.findings} ${this.result.report.findings===1?'finding':'findings'} in ${this.result.report.checked} ${this.result.report.checked===1?'note':'notes'}` : `Incomplete: ${this.result.reason}`;
    } catch { this.result = {status:'incomplete',reason:'Plugin or worker failed'}; this.status = 'Incomplete: plugin or worker failed'; }
    finally { if (url) URL.revokeObjectURL(url); this.controller = null; if (!this.disposed) this.refresh(); }
  }
  async runWiki() {
    if (this.controller) {new Notice('A check is running');return;}
    if (this.wikiProfile === 'none') {new Notice('Choose a Wiki profile in settings before checking');return;}
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') {new Notice('Open a Markdown note first');return;}
    this.mode = 'wiki';this.scope = file.path;this.wikiResult = null;this.status = 'Checking Wiki layout…';
    const controller = new AbortController();this.controller = controller;
    let url:string|undefined;
    try {
      await this.openResults();
      const bytes = Uint8Array.from(atob(WIKI_WASM_BASE64),c=>c.charCodeAt(0));
      url = URL.createObjectURL(new Blob([WIKI_WORKER_SOURCE],{type:'text/javascript'}));
      const workerUrl = url;
      this.wikiResult = await validateWikiNote(this.app.vault,file,bytes,{profile:this.wikiProfile,getFrontMatterInfo,parseYaml,signal:controller.signal,createWorker:()=>new Worker(workerUrl)}) as WikiOutcome;
      this.status = this.wikiResult.status === 'complete' ? `Completed: ${this.wikiResult.report.findings.length} ${this.wikiResult.report.findings.length === 1 ? 'finding' : 'findings'}` : this.wikiResult.status === 'not_applicable' ? 'Not applicable: profile or Wiki target not selected' : `Incomplete: ${this.wikiResult.reason}`;
    } catch {this.wikiResult = {status:'incomplete',reason:'plugin_or_worker_failed'};this.status = 'Incomplete: plugin or worker failed';}
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
    el.createEl('h2',{text:this.plugin.mode === 'wiki' ? 'Wiki layout' : 'Work link style'});
    el.createEl('p',{text:this.plugin.status,attr:{role:'status','aria-live':'polite'}});
    if (this.plugin.scope) el.createEl('p',{text:`Scope: ${this.plugin.scope}`});
    if(this.plugin.controller) el.createEl('button',{text:'Cancel check'}).addEventListener('click',()=>this.plugin.controller?.abort());
    if(this.plugin.mode === 'wiki') {
      const result=this.plugin.wikiResult;
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
class Settings extends PluginSettingTab {
  constructor(app:ViggObsidian['app'],private plugin:ViggObsidian){super(app,plugin);}
  getSettingDefinitions():SettingDefinitionItem[]{
    return [{name:'Work link-style rules',desc:'Opt in to the work conventions: direct wikilinks, source labels and wiki metadata. These conventions can differ from your vault’s style. No notes are changed.',render:setting=>{setting.addToggle(toggle=>toggle.setValue(this.plugin.workRules).onChange(async value=>{
      try {await this.plugin.saveData({...this.plugin.savedSettings,workRules:value,wikiProfile:this.plugin.wikiProfile});this.plugin.savedSettings.workRules=value; this.plugin.workRules=value; if(!value)this.plugin.controller?.abort();}
      catch {toggle.setValue(this.plugin.workRules);new Notice('Could not save the rule selection');}
    }));}}, {name:'Wiki profile',desc:'Checks wiki.md beneath a wiki folder and notes with cssclasses: [vault-wiki-direct]. Does not check files or shortcut targets.',render:setting=>{setting.addDropdown(dropdown=>dropdown.addOption('none','Off').addOption('numbered-v1','Numbered-v1 · Wiki').setValue(this.plugin.wikiProfile).onChange(async value=>{
      try {await this.plugin.saveData({...this.plugin.savedSettings,workRules:this.plugin.workRules,wikiProfile:value});this.plugin.savedSettings.wikiProfile=value;this.plugin.wikiProfile=value;this.plugin.controller?.abort();}
      catch {dropdown.setValue(this.plugin.wikiProfile);new Notice('Could not save the rule selection');}
    }));}}];
  }
}
