// Required actual Obsidian host test. Only fictional fixtures in the designated test vault.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,existsSync,unlinkSync,readFileSync,realpathSync} from 'node:fs';
import {isAbsolute,resolve,relative,sep,basename} from 'node:path';
const designated=process.env.VIGGVAULT_TEST_ROOT;
const privateTmp=process.env.VIGGVAULT_PRIVATE_TMP;
if(!designated||!privateTmp||!isAbsolute(designated)||!isAbsolute(privateTmp))throw Error('Explicit absolute test root and private .tmp root required');
const testRoot=realpathSync(designated);
const tmpRoot=realpathSync(privateTmp);
if(basename(testRoot)!=='obsidian-test-vault'||basename(tmpRoot)!=='.tmp')throw Error('Designated test vault and private .tmp required');
const evidence = process.env.VIGGVAULT_HOST_EVIDENCE;
if(!evidence||!isAbsolute(evidence))throw Error('Explicit absolute evidence directory required');
const evidenceRelative=relative(tmpRoot,resolve(evidence));
if(!evidenceRelative||evidenceRelative==='..'||evidenceRelative.startsWith('..'+sep)||isAbsolute(evidenceRelative))throw Error('Evidence must be inside private .tmp');
mkdirSync(evidence,{recursive:true});
const actualRelative=relative(tmpRoot,realpathSync(evidence));
if(!actualRelative||actualRelative==='..'||actualRelative.startsWith('..'+sep)||isAbsolute(actualRelative))throw Error('Evidence symlink leaves private .tmp');
for(const name of ['failure.json','assertions.json'])if(existsSync(evidence+'/'+name))unlinkSync(evidence+'/'+name);
const result = execFileSync('obsidian',['vault=obsidian-test-vault','eval',`code=${String.raw`(async()=>{
const assert=(ok,message)=>{if(!ok)throw Error(message);};
assert(app.vault.adapter.getBasePath()===${JSON.stringify(testRoot)},'wrong vault');
const p=app.plugins.plugins['vigg-vault']; assert(p,'plugin not loaded');assert(p.manifest.version==='0.2.0','wrong candidate version');
const initialFile=app.workspace.getActiveFile(); const initialLeaf=app.workspace.getMostRecentLeaf();
const sidebarCollapsed=app.workspace.rightSplit.collapsed;
const contents=require('@electron/remote').getCurrentWindow().webContents;const throttled=contents.getBackgroundThrottling();contents.setBackgroundThrottling(false);
const capture=async()=>{await contents.capturePage();await new Promise(r=>setTimeout(r,200));return contents.capturePage();};
const oldRules=p.workRules;const oldWiki=p.wikiProfile; const oldData=await p.loadData();
const oldPlugins=Array.from(app.plugins.enabledPlugins).filter(id=>id!=='vigg-vault').sort();
const root='fixtures/viggvault-plugin-proof'; assert(!app.vault.getAbstractFileByPath(root),'fixture namespace already exists');
const created=[]; const observations={};
const wait=async()=>{const end=Date.now()+15000;while(p.controller&&Date.now()<end)await new Promise(r=>setTimeout(r,20));assert(!p.controller,'plugin did not settle');};
const command=async(id)=>{assert(app.commands.executeCommandById('vigg-vault:'+id),'command missing '+id);await wait();};
try{
await app.vault.createFolder(root);created.push(root);
await app.vault.createFolder(root+'/folder');created.push(root+'/folder');
const owner=await app.vault.create(root+'/owner.md','# Fictional owner\n\n[[fixtures/viggvault-plugin-proof/folder/target]]\n');created.push(owner.path);
const target=await app.vault.create(root+'/folder/target.md','# Fictional target\n');created.push(target.path);
await initialLeaf.openFile(owner,{active:true});
const previous=p.result;p.workRules=false; await command('check-note'); assert(p.result===previous&&!p.controller,'optout performed check');observations.optInDisabledByDefault=true;
p.workRules=true; await p.saveData({workRules:true});
await command('check-note'); assert(p.result?.status==='complete','note check incomplete');assert(p.result.report.checked===1,'note scope wrong');
const finding=p.result.report.issues.find(i=>i.path===owner.path&&i.kind==='visible-link-path');assert(finding,'fixture finding missing');observations.note={checked:p.result.report.checked,findings:p.result.report.findings,rule:finding.kind};
await p.navigate(finding);assert(app.workspace.getActiveFile()?.path===owner.path,'navigation wrong note');const editor=app.workspace.getMostRecentLeaf()?.view.editor;assert(editor?.getCursor().line===finding.line-1,'navigation wrong line');observations.navigation=true;
await command('check-folder');assert(p.result?.status==='complete'&&p.result.report.checked===2,'folder scope wrong');observations.folder={checked:p.result.report.checked};
await command('check-vault');assert(p.result?.status==='complete'&&p.result.report.checked>=2,'vault check incomplete');observations.vault={checked:p.result.report.checked,inventoried:p.result.report.inventoried};
app.commands.executeCommandById('vigg-vault:check-vault'); assert(p.result===null,'stale successful result retained');app.commands.executeCommandById('vigg-vault:cancel-check');await wait();assert(p.result?.status==='incomplete','cancel looked complete');observations.cancel=p.status;
const originalRead=app.vault.read;try{app.vault.read=async()=>{throw Error('synthetic read failure');};await command('check-note');assert(p.result?.status==='incomplete','read failure looked complete');observations.readFailure=p.status;}finally{app.vault.read=originalRead;}
await command('check-note');assert(p.result?.status==='complete','recovery failed');
const contents=await app.vault.read(owner);assert(contents==='# Fictional owner\n\n[[fixtures/viggvault-plugin-proof/folder/target]]\n','source mutated');observations.sourcePreserved=true;
await p.saveData({workRules:false}); await app.plugins.disablePlugin('vigg-vault');assert(!app.plugins.plugins['vigg-vault'],'unload failed');await app.plugins.enablePlugin('vigg-vault');const fresh=app.plugins.plugins['vigg-vault'];assert(fresh&&!fresh.workRules,'optin persistence failed');observations.unload=true;
fresh.workRules=true; await initialLeaf.openFile(owner,{active:true}); await fresh.run('note');assert(fresh.result?.status==='complete','reload check failed');
const pane=app.workspace.getLeavesOfType('viggobsidian-findings')[0];assert(pane?.view.contentEl.innerText.includes('visible-link-path'),'findings view missing');observations.screenText=pane.view.contentEl.innerText;
// Private screenshot capture with no OS focus takeover.
await new Promise(r=>setTimeout(r,4500));
const shot=await capture();require('node:fs').writeFileSync(${JSON.stringify(evidence+'/findings.png')},shot.toPNG());
const tab=app.setting.pluginTabs.find(t=>t.id==='vigg-vault');assert(tab&&tab.getSettingDefinitions().length===2,'settings absent');app.setting.open();app.setting.openTabById('vigg-vault');await new Promise(r=>setTimeout(r,200));const toggle=tab.containerEl.querySelector('.checkbox-container');assert(toggle,'real toggle not rendered');observations.settingsText=tab.containerEl.innerText;toggle.click();await new Promise(r=>setTimeout(r,100));assert(!fresh.workRules,'actual toggle did not disable');app.setting.close();observations.actualSettingsToggle=true;

// Wiki command uses the actual Obsidian parser and Worker, never note writes.
await initialLeaf.openFile(owner,{active:true});fresh.wikiProfile='none';const previousWiki=fresh.wikiResult;
await fresh.runWiki();assert(fresh.wikiResult===previousWiki&&!fresh.controller,'Wiki optout scanned');observations.wikiOptOut=true;
fresh.wikiProfile='numbered-v1';await fresh.runWiki();assert(fresh.wikiResult?.status==='not_applicable','ordinary note was checked');
const wikiFolder=root+'/wiki';await app.vault.createFolder(wikiFolder);created.push(wikiFolder);
await app.vault.createFolder(wikiFolder+'/nested');created.push(wikiFolder+'/nested');
const wikiSource='---\r\nlayer: wiki\r\ncssclasses: [vault-wiki]\r\n---\r\n# Fictional Wiki\r\n';
const wiki=await app.vault.create(wikiFolder+'/nested/wiki.md',wikiSource);created.push(wiki.path);
await initialLeaf.openFile(wiki,{active:true});await fresh.runWiki();assert(fresh.wikiResult?.status==='complete','nested Wiki incomplete');
const wikiFinding=fresh.wikiResult.report.findings.find(f=>f.code==='wiki-preamble');assert(wikiFinding?.message==='start Wiki with a title and the Back/Raw/Finder shortcuts','upstream rule/message missing');assert(!('line' in wikiFinding)&&!('severity' in wikiFinding),'invented location or severity');
await fresh.navigateWiki(wikiFinding);assert(app.workspace.getActiveFile()?.path===wiki.path,'Wiki navigation wrong');observations.wikiFinding=wikiFinding;observations.wikiNavigation=true;
const wikiPane=app.workspace.getLeavesOfType('viggobsidian-findings')[0];assert(wikiPane.view.contentEl.innerText.includes(wikiFinding.code),'Wiki view missing');observations.wikiScreenText=wikiPane.view.contentEl.innerText;
await new Promise(r=>setTimeout(r,300));require('node:fs').writeFileSync(${JSON.stringify(evidence+'/wiki-findings.png')},(await capture()).toPNG());
const direct=await app.vault.create(root+'/direct.md','---\ncssclasses: [vault-wiki-direct]\n---\n# Direct\n');created.push(direct.path);
await initialLeaf.openFile(direct,{active:true});await fresh.runWiki();assert(fresh.wikiResult?.status==='complete','direct Wiki skipped');
const validSource='\uFEFF---\r\ncssclasses: [vault-wiki-direct]\r\n---\r\n<!-- viggobsidian:knowledge-owner -->\r\n> [!info] Actuele kennis\r\n> [[fiction/wiki/wiki|Open actuele kennis]]\r\n<!-- /viggobsidian:knowledge-owner -->\r\n# Wiki\r\n\r\n> [!navigation|shortcuts]\r\n> - [[fiction|Back]]\r\n> - [[fiction/raw/raw|Raw]]\r\n> - [Finder](file:///fiction/wiki)\r\n\r\n';
const validWiki=await app.vault.create(root+'/valid.md',validSource);created.push(validWiki.path);await initialLeaf.openFile(validWiki,{active:true});await fresh.runWiki();assert(fresh.wikiResult?.status==='complete'&&fresh.wikiResult.report.findings.length===0,'BOM/CRLF/frontmatter/maintenance preprocessing diverged');assert(await app.vault.read(validWiki)===validSource,'valid Wiki fixture changed');observations.wikiBodyPreprocessing=true;
const layerOnly=await app.vault.create(root+'/layer-only.md','---\nlayer: wiki\n---\n# Ordinary\n');created.push(layerOnly.path);
await initialLeaf.openFile(layerOnly,{active:true});await fresh.runWiki();assert(fresh.wikiResult?.status==='not_applicable','layer alone selected Wiki');
const missingFM=await app.vault.create(wikiFolder+'/wiki.md','# Missing frontmatter\n');created.push(missingFM.path);await initialLeaf.openFile(missingFM,{active:true});await fresh.runWiki();assert(fresh.wikiResult?.status==='incomplete'&&fresh.wikiResult.reason==='frontmatter_required','selected Wiki without metadata looked complete');
const malformed=await app.vault.create(root+'/malformed.md','---\ncssclasses: [unclosed\n---\n# Ordinary\n');created.push(malformed.path);
await initialLeaf.openFile(malformed,{active:true});await fresh.runWiki();assert(fresh.wikiResult?.status==='incomplete','malformed metadata looked complete');
await initialLeaf.openFile(wiki,{active:true});fresh.wikiProfile='future';await fresh.runWiki();assert(fresh.wikiResult?.status==='not_applicable','unknown profile checked');fresh.wikiProfile='numbered-v1';
let read=app.vault.read;
try{app.vault.read=async()=>{throw Error('synthetic Wiki read');};await fresh.runWiki();assert(fresh.wikiResult?.status==='incomplete','Wiki read error looked complete');}finally{app.vault.read=read;}
try{app.vault.read=async file=>{const body=await read.call(app.vault,file);app.vault.trigger('modify',file);return body;};await fresh.runWiki();assert(fresh.wikiResult?.status==='incomplete','Wiki drift looked complete');}finally{app.vault.read=read;}
let running=fresh.runWiki();fresh.controller?.abort();await running;assert(fresh.wikiResult?.status==='incomplete','Wiki cancel looked complete');
await fresh.runWiki();assert(fresh.wikiResult?.status==='complete','Wiki recovery failed');assert(await app.vault.read(wiki)===wikiSource,'Wiki fixture bytes changed');
// Unload while an actual capture is pending; then verify settings migration/persistence.
try{app.vault.read=()=>new Promise(()=>{});running=fresh.runWiki();await new Promise(r=>setTimeout(r,20));await app.plugins.disablePlugin('vigg-vault');await running;assert(fresh.wikiResult?.status==='incomplete','Wiki unload looked complete');}finally{app.vault.read=read;}
await app.plugins.enablePlugin('vigg-vault');let last=app.plugins.plugins['vigg-vault'];await last.saveData({...oldData,workRules:false,wikiProfile:'numbered-v1',fictionalCompatibilityKey:'preserve'});await app.plugins.disablePlugin('vigg-vault');await app.plugins.enablePlugin('vigg-vault');last=app.plugins.plugins['vigg-vault'];assert(last.wikiProfile==='numbered-v1'&&!last.workRules,'Wiki setting not persistent');assert(last.savedSettings.fictionalCompatibilityKey==='preserve','unknown setting lost');
observations.wiki={ordinarySkipped:true,layerOnlySkipped:true,directAndNestedChecked:true,malformedIncomplete:true,missingFrontmatterIncomplete:true,unknownProfileSkipped:true,readDriftCancelUnloadIncomplete:true,recovery:true,sourcePreserved:true,settingsPersistent:true};
} finally {
const current=app.plugins.plugins['vigg-vault'];if(current){current.controller?.abort();await current.saveData(oldData??{});current.workRules=oldRules;current.wikiProfile=oldWiki;current.savedSettings=oldData??{};}
for(const leaf of app.workspace.getLeavesOfType('viggobsidian-findings'))leaf.detach();
if(sidebarCollapsed)app.workspace.rightSplit.collapse();else app.workspace.rightSplit.expand();
contents.setBackgroundThrottling(throttled);
if(initialFile&&initialLeaf)await initialLeaf.openFile(initialFile,{active:true});
for(const path of created.reverse()){const file=app.vault.getAbstractFileByPath(path);if(file)await app.vault.delete(file,true);}
assert(JSON.stringify(Array.from(app.plugins.enabledPlugins).filter(id=>id!=='vigg-vault').sort())===JSON.stringify(oldPlugins),'unrelated plugins changed');
assert(app.workspace.getActiveFile()?.path===initialFile?.path,'active note not restored');
observations.activeNoteAndOtherPluginsRestored=true;observations.fixturesRemoved=!app.vault.getAbstractFileByPath(root);assert(observations.fixturesRemoved,'fixture cleanup failed');
}
require('node:fs').writeFileSync(${JSON.stringify(evidence+'/assertions.json')},JSON.stringify(observations,null,2));return observations;
})().catch(error=>{const failure={error:String(error.stack)};require('node:fs').writeFileSync(${JSON.stringify(evidence+'/failure.json')},JSON.stringify(failure));return JSON.stringify(failure);})`}`],{encoding:'utf8',maxBuffer:1024*1024,timeout:60000});
// CLI returns before longer Promises settle; observe our explicit terminal files.
const deadline=Date.now()+60000;
while(!existsSync(evidence+'/assertions.json')&&!existsSync(evidence+'/failure.json')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
if(existsSync(evidence+'/failure.json'))throw Error(readFileSync(evidence+'/failure.json','utf8'));
if(!existsSync(evidence+'/assertions.json'))throw Error('Host proof did not complete; inspect test vault before rerunning');
writeFileSync(evidence+'/host-proof.txt',result);
process.stdout.write(readFileSync(evidence+'/assertions.json','utf8'));
