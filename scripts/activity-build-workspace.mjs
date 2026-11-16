// Necessary npm/Cargo build boundary. Copies only hash-pinned upstream source; no rules or runtime helper.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,realpathSync,mkdtempSync,renameSync} from 'node:fs';
import {resolve,dirname,join,relative,sep} from 'node:path';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const workspace='[workspace]\nmembers = ["activity-core", "link-style-core"]\nresolver = "3"\n';
function directory(path){mkdirSync(path,{recursive:true});if(lstatSync(path).isSymbolicLink()||!lstatSync(path).isDirectory()||realpathSync(path)!==path)throw Error('Build directory must be canonical and nonsymlink');}
export function activityBuildPaths(root){root=realpathSync(root);const build=resolve(root,'build');directory(build);const target=join(build,'activity-rust');directory(target);return{build,target};}
function source(root,path){if(!path||path.split('/').some(p=>!p||p==='.'||p==='..')||path.includes('\\')||path.includes(':'))throw Error('Unsafe provenance path');let current=root;for(const part of path.split('/')){current=join(current,part);if(lstatSync(current).isSymbolicLink())throw Error('Symlinked provenance input');}if(!lstatSync(current).isFile()||realpathSync(current)!==current)throw Error('Source input is not a canonical regular file');return readFileSync(current);}
function verifyTree(root,expected){const found=[];function visit(path){for(const entry of readdirSync(path,{withFileTypes:true})){const full=join(path,entry.name),rel=relative(root,full).split(sep).join('/');if(entry.isSymbolicLink())throw Error('Symlink in build workspace');if(entry.isDirectory()){if(![...expected.keys()].some(p=>p.startsWith(rel+'/')))throw Error('Unexpected build workspace directory');visit(full);}else if(entry.isFile()){if(!expected.has(rel)||sha(readFileSync(full))!==sha(expected.get(rel)))throw Error('Build workspace input drift: '+rel);found.push(rel);}else throw Error('Nonregular build workspace input');}}visit(root);if(found.length!==expected.size)throw Error('Incomplete build workspace');}
export function prepareActivityWorkspace(root){
 root=realpathSync(root);const provenance=JSON.parse(source(root,'vendor/wasm/activity-provenance.json'));const inputs=new Map();
 for(const[path,digest]of Object.entries(provenance.sourceFiles)){if(!/^[a-f0-9]{64}$/.test(digest))throw Error('Invalid source digest');const bytes=source(root,path);if(sha(bytes)!==digest)throw Error('Activity source provenance mismatch: '+path);if(path.startsWith('vendor/activity-core/')||path.startsWith('vendor/link-style-core/'))inputs.set(path.slice('vendor/'.length),bytes);}
 for(const path of ['activity-core/Cargo.toml','activity-core/Cargo.lock','activity-core/src/lib.rs','link-style-core/Cargo.toml','link-style-core/src/lib.rs'])if(!inputs.has(path))throw Error('Required pinned source missing: '+path);
 inputs.set('Cargo.toml',Buffer.from(workspace));inputs.set('Cargo.lock',inputs.get('activity-core/Cargo.lock'));
 const digest=sha(Buffer.from(JSON.stringify([...inputs].map(([path,bytes])=>[path,sha(bytes)]).sort(([a],[b])=>a<b?-1:a>b?1:0))));
 inputs.set('inputs.json',Buffer.from(JSON.stringify({schema:'vigg-vault.activity-build-workspace.v1',sha256:digest},null,2)+'\n'));
 const build=resolve(root,'build');directory(build);const container=join(build,'activity-wasm-source');directory(container);const stage=join(container,digest);
 try{lstatSync(stage);if(lstatSync(stage).isSymbolicLink()||!lstatSync(stage).isDirectory()||realpathSync(stage)!==stage)throw Error('Invalid build workspace');verifyTree(stage,inputs);}catch(error){if(error.code!=='ENOENT')throw error;const temporary=mkdtempSync(join(container,'stage-'));for(const[path,bytes]of inputs){const target=join(temporary,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes,{flag:'wx'});}verifyTree(temporary,inputs);renameSync(temporary,stage);}
 return {root:stage,sha256:digest};
}
