// Required build/release artifact inspection, including the actual embedded WASM.
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export function embeddedWasm(bundle,index=0){
  const matches=[...bundle.matchAll(/atob\("([A-Za-z0-9+/=]+)"\)/g)];
  if(!matches[index])throw Error('Expected embedded WASM payload');
  const bytes=Buffer.from(matches[index][1],'base64');
  if(!bytes.subarray(0,8).equals(Buffer.from([0,97,115,109,1,0,0,0])))throw Error('Invalid embedded WASM header');
  return bytes;
}
export function assertArtifactPrivacy(bytes,privateRoots=[]){
  const text=Buffer.from(bytes).toString('utf8');
  // Generic home/checkouts, credentials and private source endpoints must never ship.
  if(/(?:\/Users\/|\/home\/|[A-Z]:[\\/]Users[\\/])[^\s\0"']+|(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})|-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/i.test(text))throw Error('Artifact contains a private path or credential');
  for(const root of privateRoots.filter(Boolean))if(text.includes(root)||text.includes(root.replaceAll('\\','/')))throw Error('Artifact contains a local build root');
}
export function verifyPinnedWasm(bytes,expectedDigest){
  if(createHash('sha256').update(bytes).digest('hex')!==expectedDigest)throw Error('Pinned WASM digest mismatch');
}
export function checkArtifacts(root=process.cwd()){
  const bundle=readFileSync(resolve(root,'main.js'),'utf8');
  const standalone=readFileSync(resolve(root,'vendor/wasm/link_style_core.wasm'));
  const provenance=JSON.parse(readFileSync(resolve(root,'vendor/wasm/provenance.json'),'utf8'));
  verifyPinnedWasm(standalone,provenance.sha256);
  for(const [path,digest]of Object.entries(provenance.sourceFiles))if(createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')!==digest)throw Error('WASM source provenance mismatch: '+path);
  const embedded=embeddedWasm(bundle);
  const wiki=readFileSync(resolve(root,'vendor/wasm/wiki_layout_core.wasm'));
  const wikiProvenance=JSON.parse(readFileSync(resolve(root,'vendor/wasm/wiki-provenance.json'),'utf8'));
  verifyPinnedWasm(wiki,wikiProvenance.sha256);
  for(const [path,digest]of Object.entries(wikiProvenance.sourceFiles))if(createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')!==digest)throw Error('Wiki WASM source provenance mismatch: '+path);
  const wikiEmbedded=embeddedWasm(bundle,1);
  if([...bundle.matchAll(/atob\("([A-Za-z0-9+/=]+)"\)/g)].length!==2)throw Error('Expected exactly two embedded WASM payloads');
  if(!wiki.equals(wikiEmbedded))throw Error('Embedded Wiki WASM differs from pinned WASM');
  const privateRoots=[homedir(),process.env.CARGO_HOME,resolve(root)];
  for(const bytes of [Buffer.from(bundle),standalone,embedded,wiki,wikiEmbedded])assertArtifactPrivacy(bytes,privateRoots);
  if(!standalone.equals(embedded))throw Error('Embedded WASM differs from pinned WASM');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  checkArtifacts();
  if(process.argv.includes('--verify-rust-build')){
    const built=readFileSync('build/rust/wasm32-unknown-unknown/release/link_style_core.wasm');
    if(!built.equals(readFileSync('vendor/wasm/link_style_core.wasm')))throw Error('Rust build differs from pinned WASM; byte reproduction requires the recorded canonical platform/toolchain. The asset was not overwritten.');
    const wikiBuilt=readFileSync('build/wiki-rust/wasm32-unknown-unknown/release/wiki_layout_core.wasm');
    if(!wikiBuilt.equals(readFileSync('vendor/wasm/wiki_layout_core.wasm')))throw Error('Wiki Rust build differs from pinned WASM');
    console.log('Canonical Rust builds equal pinned WASM');
  }
  console.log('Artifact privacy: bundle and decoded pinned WASM passed');
}
