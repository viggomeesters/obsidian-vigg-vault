// Required build-artifact checks: pin provenance and verify delivered WASM boundary/notices.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('vendored source remains byte-exact and the bundled artifact retains license notices',()=>{
  const provenance=JSON.parse(readFileSync('vendor/provenance.json','utf8'));
  for(const [path,hash]of Object.entries(provenance.unchangedFiles))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash,path);
  const bundle=readFileSync('main.js','utf8');assert.ok(bundle.includes('Copyright (c) 2026 Viggo Meesters'));assert.ok(bundle.includes('encoding_rs-0.8.44/LICENSE-WHATWG'));assert.ok(bundle.includes('unicode-ident-1.0.27/LICENSE-UNICODE'));
});
test('delivered WASM imports nothing and enforces the 256 MiB memory cap',async()=>{
  const wasm=readFileSync('build/rust/wasm32-unknown-unknown/release/link_style_core.wasm');const module=await WebAssembly.compile(wasm);assert.deepEqual(WebAssembly.Module.imports(module),[]);const instance=await WebAssembly.instantiate(module,{});assert.throws(()=>instance.exports.memory.grow(4096),RangeError);
});

import {assertArtifactPrivacy,embeddedWasm,checkArtifacts} from '../scripts/artifact-privacy.mjs';
test('release artifacts contain no private roots, including decoded embedded WASM',()=>checkArtifacts());
test('privacy gate rejects a private path hidden only in embedded WASM',()=>{
  const header=Buffer.from([0,97,115,109,1,0,0,0]);
  const bad=Buffer.concat([header,Buffer.from('/Users/fictional/.cargo/registry/src/dependency.rs')]);
  const bundle=`atob("${bad.toString('base64')}")`;
  assert.doesNotThrow(()=>assertArtifactPrivacy(Buffer.from(bundle)));
  assert.throws(()=>assertArtifactPrivacy(embeddedWasm(bundle)),/private path/);
  const good=Buffer.concat([header,Buffer.from('/build/cargo/registry/src/dependency.rs')]);
  assert.doesNotThrow(()=>assertArtifactPrivacy(embeddedWasm(`atob("${good.toString('base64')}")`)));
  assert.throws(()=>assertArtifactPrivacy(Buffer.from('/custom/build/root/file.rs'),['/custom/build/root']),/build root/);
  assert.throws(()=>embeddedWasm('atob("bm90LXdhc20=")'),/header/);
});
