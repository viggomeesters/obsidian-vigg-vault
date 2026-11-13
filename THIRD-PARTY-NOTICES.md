# Third-party notices

The engine, Worker and Vault adapter are MIT-licensed ViggObsidian sources by Viggo Meesters. Exact source revision and hashes: vendor/provenance.json. Original license: vendor/LICENSE.

The Rust/WASM dependency set and source repositories are enumerated in docs/licenses/rust-dependencies.json. Retained original license texts and notices are in docs/licenses/. These include MIT/Apache alternatives, encoding_rs's additional WHATWG/BSD notice and unicode-ident's Unicode license. Build dependencies are included conservatively; the WASM runtime contains only the applicable compiled subset.

The Rust standard library is distributed under MIT OR Apache-2.0 (https://github.com/rust-lang/rust). Obsidian is provided by the host application and is not redistributed. Node/esbuild/TypeScript/ESLint and Obsidian type definitions are development tools; their code is not bundled into main.js.

The separately pinned Wiki Rust core is MIT-licensed ViggObsidian source by Viggo Meesters. Its exact source/protocol/license pin is vendor/wiki-provenance.json; canonical WASM digest/build inputs are vendor/wasm/wiki-provenance.json. Its serde_json dependency closure is a subset of the retained Rust dependency notices above.

The separately pinned Activity Rust core is MIT-licensed ViggObsidian source by Viggo Meesters. Exact source/protocol/license pin: vendor/activity-provenance.json; canonical WASM digest/build inputs: vendor/wasm/activity-provenance.json. Its dependency closure reuses the unchanged link-style-core helpers and the retained Rust dependency notices above; no new registry dependency is introduced.
