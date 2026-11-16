// Required npm/Cargo build boundary. No engine or runtime logic lives here.
import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import {realpathSync,openSync,closeSync,unlinkSync,lstatSync,fstatSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {prepareActivityWorkspace,activityBuildPaths} from './activity-build-workspace.mjs';
const root=realpathSync(new URL('..',import.meta.url));
const canonical=path=>realpathSync(resolve(root,path));
// Cargo's encoded form preserves paths containing spaces on every supported OS.
// The last matching --remap-path-prefix wins: specific roots follow HOME.
const {build,target}=activityBuildPaths(root);
const lock=resolve(build,'.activity-wasm-build.lock'),fd=openSync(lock,'wx'),owner=fstatSync(fd);
try{
 writeFileSync(fd,JSON.stringify({schema:'vigg-vault.activity-build-owner.v1',pid:process.pid,launcherStartedAt:new Date(Date.now()-process.uptime()*1000).toISOString(),acquiredAt:new Date().toISOString(),root,target,buildScript:'scripts/build-activity-wasm.mjs'},null,2)+'\n');
 const stage=prepareActivityWorkspace(root);
 const roots=[[canonical(homedir()),'/build/home'],[canonical(process.env.CARGO_HOME||resolve(homedir(),'.cargo')),'/build/cargo'],[root,'/build/source'],[stage.root,'/build/activity-source']];
 const flags=['-C','link-arg=--max-memory=268435456',...roots.map(([from,to])=>`--remap-path-prefix=${from}=${to}`)];
 const result=spawnSync('cargo',['build','--manifest-path',resolve(stage.root,'activity-core/Cargo.toml'),'--locked','--release','--target','wasm32-unknown-unknown','--target-dir',target],{cwd:root,env:{...process.env,RUSTFLAGS:'',CARGO_ENCODED_RUSTFLAGS:flags.join('\x1f')},stdio:'inherit'});
 if(result.error)throw result.error;process.exitCode=result.status??1;
}finally{closeSync(fd);const current=lstatSync(lock);if(current.dev===owner.dev&&current.ino===owner.ino)unlinkSync(lock);else throw Error('Build lock identity changed; preserved replacement');}
