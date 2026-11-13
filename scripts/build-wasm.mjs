// Required npm/Cargo build boundary. No engine or runtime logic lives here.
import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import {realpathSync} from 'node:fs';
import {resolve} from 'node:path';
const root=realpathSync(new URL('..',import.meta.url));
const canonical=path=>realpathSync(resolve(root,path));
// Cargo's encoded form preserves paths containing spaces on every supported OS.
// The last matching --remap-path-prefix wins: specific roots follow HOME.
const roots=[[canonical(homedir()),'/build/home'],[canonical(process.env.CARGO_HOME||resolve(homedir(),'.cargo')),'/build/cargo'],[root,'/build/source']];
const flags=['-C','link-arg=--max-memory=268435456',...roots.map(([from,to])=>`--remap-path-prefix=${from}=${to}`)];
const result=spawnSync('cargo',['build','--manifest-path','vendor/link-style-core/Cargo.toml','--locked','--release','--target','wasm32-unknown-unknown','--target-dir','build/rust'],{cwd:root,env:{...process.env,RUSTFLAGS:'',CARGO_ENCODED_RUSTFLAGS:flags.join('\x1f')},stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
