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
const corpus=JSON.parse(readFileSync('vendor/activity-core/fixtures/activity-legacy.json','utf8'));
const result=execFileSync('obsidian',['vault=obsidian-test-vault','eval',`code=${String.raw`(async()=>{
const assert=(ok,message)=>{if(!ok)throw Error(message);};
assert(app.vault.adapter.getBasePath()===${JSON.stringify(testRoot)},'wrong vault');
let p=app.plugins.plugins['vigg-vault'];assert(p?.manifest.version==='0.3.0','wrong candidate');
const initialFile=app.workspace.getActiveFile(),initialLeaf=app.workspace.getMostRecentLeaf(),collapsed=app.workspace.rightSplit.collapsed;
const contents=require('@electron/remote').getCurrentWindow().webContents,throttled=contents.getBackgroundThrottling();contents.setBackgroundThrottling(false);
const oldData=await p.loadData(),oldProfile=p.activityProfile,otherPlugins=Array.from(app.plugins.enabledPlugins).filter(id=>id!=='vigg-vault').sort();
const root='fixtures/viggvault-activity-proof',created=[],sources=new Map(),observations={};assert(!app.vault.getAbstractFileByPath(root),'fixture namespace exists');
const corpus=${JSON.stringify(corpus)};
const fs=require('node:fs'),path=require('node:path');
const wait=async()=>{const end=Date.now()+15000;while(p.controller&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,20));assert(!p.controller,'check timeout');};
const run=async file=>{await initialLeaf.openFile(file,{active:true});assert(app.commands.executeCommandById('vigg-vault:check-activity-note'),'command missing');await wait();return p.activityResult;};
const make=async(name,metadata,body)=>{const file=await app.vault.create(root+'/'+name+'.md',metadata===null?body:'---\n'+metadata+'\n---\n'+body);created.push(file.path);sources.set(file.path,fs.readFileSync(path.join(app.vault.adapter.getBasePath(),file.path)));return file;};
try{
 await app.vault.createFolder(root);created.push(root);
 const human=await make('human','activity_contract: provenance-v1',corpus.cases.find(c=>c.id==='human').body);
 p.activityProfile='none';const before=p.activityResult;await run(human);assert(p.activityResult===before,'optout scanned');observations.optOut=true;p.activityProfile='numbered-v1';
 observations.valid={};
 for(const id of ['human','agent','legacy-top','header','mail-delivery']){const file=id==='human'?human:await make(id,'activity_contract: provenance-v1',corpus.cases.find(c=>c.id===id).body);const result=await run(file);assert(result?.status==='complete'&&result.report.findings.length===0,id+' invalid: '+JSON.stringify(result));observations.valid[id]=true;}
 const legacy=await make('legacy','activity_format: chat-v1',corpus.cases.find(c=>c.id==='legacy-chat').body);assert((await run(legacy))?.report?.findings.length===0,'legacy chat changed');observations.legacyChat=true;
 const event=await make('event','cssclasses: [vault-event-v1-1]',corpus.cases.find(c=>c.id==='human').body);assert((await run(event))?.report?.findings.length===0,'Event Activity tail failed');observations.eventActivity=true;
 const ordinary=await make('ordinary','type: reference','# Historical note\n');assert((await run(ordinary))?.status==='not_applicable','ordinary looked checked');observations.ordinarySkipped=true;
 const bad=await make('bad','activity_contract: provenance-v1',corpus.cases.find(c=>c.id==='wrong-author').body);let result=await run(bad);assert(result?.status==='complete'&&result.report.findings.some(f=>f.code==='strict-activity-provenance'),'bad provenance missing');const finding=result.report.findings[0];assert(!('line'in finding)&&!('severity'in finding),'invented location');await p.navigateWiki(finding);assert(app.workspace.getActiveFile()?.path===bad.path,'note navigation failed');
 const pane=app.workspace.getLeavesOfType('viggobsidian-findings')[0];assert(pane?.view.contentEl.innerText.includes(finding.code),'findings not rendered');observations.screenText=pane.view.contentEl.innerText;
 await new Promise(resolve=>setTimeout(resolve,4500));await contents.capturePage();fs.writeFileSync(${JSON.stringify(evidence+'/activity-findings.png')},(await contents.capturePage()).toPNG());
 const missing=await make('missing-frontmatter',null,'# Missing metadata\n');assert((await run(missing))?.status==='incomplete','missing metadata looked clean');
 const malformed=await make('malformed','activity_contract: [unclosed','# Malformed\n');assert((await run(malformed))?.status==='incomplete','malformed YAML looked clean');observations.missingMalformedIncomplete=true;
 await initialLeaf.openFile(human,{active:true});
 const read=app.vault.read;let injected=0;
 try{app.vault.read=async file=>{const text=await read.call(app.vault,file);if(file===human&&injected===0){injected++;app.vault.trigger('modify',file);}return text;};await p.runActivity();assert(p.activityResult?.status==='incomplete'&&p.activityResult.reason==='snapshot_changed','drift looked complete');}finally{app.vault.read=read;}
 assert(injected===1,'drift did not occur once');await p.runActivity();assert(p.activityResult?.status==='complete','immediate recovery failed');observations.oneDriftAndRecovery=true;
 let pending=p.runActivity();p.controller?.abort();await pending;assert(p.activityResult?.status==='incomplete','cancel looked complete');observations.cancel=true;
 try{app.vault.read=async()=>{throw Error('synthetic Activity read failure');};await p.runActivity();assert(p.activityResult?.status==='incomplete','read failure looked complete');}finally{app.vault.read=read;}
 await p.runActivity();assert(p.activityResult?.status==='complete','read recovery failed');
 try{app.vault.read=()=>new Promise(()=>{});pending=p.runActivity();await new Promise(resolve=>setTimeout(resolve,20));await app.plugins.disablePlugin('vigg-vault');await pending;assert(p.activityResult?.status==='incomplete','unload looked complete');}finally{app.vault.read=read;}
 await app.plugins.enablePlugin('vigg-vault');p=app.plugins.plugins['vigg-vault'];observations.unload=true;
 await p.saveData({...oldData,workRules:false,wikiProfile:'numbered-v1',activityProfile:'numbered-v1',fictionalActivityCompatibilityKey:'preserve'});await app.plugins.disablePlugin('vigg-vault');await app.plugins.enablePlugin('vigg-vault');p=app.plugins.plugins['vigg-vault'];assert(p.activityProfile==='numbered-v1'&&p.wikiProfile==='numbered-v1'&&!p.workRules&&p.savedSettings.fictionalActivityCompatibilityKey==='preserve','settings reload failed');
 const tab=app.setting.pluginTabs.find(t=>t.id==='vigg-vault');assert(tab?.getSettingDefinitions().length===3,'settings missing');app.setting.open();app.setting.openTabById('vigg-vault');await new Promise(resolve=>setTimeout(resolve,100));
 // Obsidian can render generated proxy selects beside declarative controls.
 // Bind the real control to its visible setting name and supported option.
 const selects=Array.from(tab.containerEl.querySelectorAll('select'));
 observations.settingControls=selects.map(select=>({name:select.closest('.setting-item')?.querySelector('.setting-item-name')?.textContent?.trim(),value:select.value,options:Array.from(select.options).map(option=>({value:option.value,text:option.text}))}));
 const activityControls=selects.filter(select=>select.closest('.setting-item')?.querySelector('.setting-item-name')?.textContent?.trim()==='Activity profile'&&select.querySelector('option[value="numbered-v1"]'));
 assert(activityControls.length===1,'Activity setting must expose exactly one real profile control');const select=activityControls[0];assert(select.value==='numbered-v1','Activity real control has wrong initial profile');select.value='none';select.dispatchEvent(new Event('change',{bubbles:true}));
 const savedDeadline=Date.now()+5000;let data;do{data=await p.loadData();if(p.activityProfile==='none'&&data.activityProfile==='none')break;await new Promise(resolve=>setTimeout(resolve,20));}while(Date.now()<savedDeadline);
 assert(p.activityProfile==='none'&&data.activityProfile==='none','Activity UI optout not saved');assert(data.fictionalActivityCompatibilityKey==='preserve'&&data.wikiProfile==='numbered-v1','settings save lost unknown or Wiki data');observations.settingsText=tab.containerEl.innerText;await contents.capturePage();fs.writeFileSync(${JSON.stringify(evidence+'/activity-settings.png')},(await contents.capturePage()).toPNG());app.setting.close();observations.settingsPersistence=true;
 for(const [file,bytes]of sources)assert(bytes.equals(fs.readFileSync(path.join(app.vault.adapter.getBasePath(),file))),'source bytes changed '+file);observations.sourceBytesPreserved=true;
}finally{
 app.setting.close();
 const current=app.plugins.plugins['vigg-vault'];if(current){current.controller?.abort();await current.saveData(oldData??{});current.activityProfile=oldProfile;current.wikiProfile=typeof oldData?.wikiProfile==='string'?oldData.wikiProfile:'none';current.workRules=oldData?.workRules===true;current.savedSettings=oldData??{};}
 for(const leaf of app.workspace.getLeavesOfType('viggobsidian-findings'))leaf.detach();if(collapsed)app.workspace.rightSplit.collapse();else app.workspace.rightSplit.expand();contents.setBackgroundThrottling(throttled);if(initialFile&&initialLeaf)await initialLeaf.openFile(initialFile,{active:true});
 for(const name of created.reverse()){const file=app.vault.getAbstractFileByPath(name);if(file)await app.vault.delete(file,true);}
 assert(JSON.stringify(Array.from(app.plugins.enabledPlugins).filter(id=>id!=='vigg-vault').sort())===JSON.stringify(otherPlugins),'other plugins changed');assert(app.workspace.getActiveFile()?.path===initialFile?.path,'active note not restored');assert(!app.vault.getAbstractFileByPath(root),'fixtures remain');observations.activeNoteSettingsOtherPluginsRestored=true;
}
fs.writeFileSync(${JSON.stringify(evidence+'/assertions.json')},JSON.stringify(observations,null,2));return observations;
})().catch(error=>{const failure={error:String(error.stack)};require('node:fs').writeFileSync(${JSON.stringify(evidence+'/failure.json')},JSON.stringify(failure));return failure;})`}`],{encoding:'utf8',maxBuffer:1024*1024,timeout:60000});
const deadline=Date.now()+60000;while(!existsSync(evidence+'/assertions.json')&&!existsSync(evidence+'/failure.json')&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
if(existsSync(evidence+'/failure.json'))throw Error(readFileSync(evidence+'/failure.json','utf8'));if(!existsSync(evidence+'/assertions.json'))throw Error('Activity host proof did not complete; inspect test vault before rerunning');writeFileSync(evidence+'/host-proof.txt',result);process.stdout.write(readFileSync(evidence+'/assertions.json','utf8'));
