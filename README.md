# ViggVault

Read-only Obsidian plugin for opt-in Work link-style checks and current-note Wiki layout checks, powered by the ViggObsidian Rust engine.

ViggVault is the user-facing product; [ViggObsidian](https://github.com/viggomeesters/viggobsidian) remains the shared engine, package source and native CLI. Both are maintained, with one upstream rule implementation. See the [product/engine boundary](docs/product-engine-boundary.md).

## Work link style

Enable **Work link-style rules** in ViggVault settings. The rules are off by default because direct wikilinks, source labels and Wiki metadata conventions may differ from your vault. No personal vault paths or configuration are required.

Run **Check current note link style**, **Check current folder link style** (includes subfolders), or **Check vault link style** from the command palette. The findings view shows scope, completion status, path, line, rule and suggested presentation. Click a finding to navigate. **Cancel check** stops capture/evaluation. Nothing applies suggestions or edits notes.

All Work scopes read the full visible Markdown inventory for resolution, including note titles. Hidden paths are excluded; 90-templates is skipped. Only selected targets are checked. Snapshot changes, limits, cancellation and errors show **Incomplete**. A completed Work check covers only this link-style rule set, not full ViggObsidian validation. Results are a snapshot; rerun after edits.

## Wiki layout

Select **Wiki profile → Numbered-v1 · Wiki** in settings, then run **Check current note Wiki layout**. The shared Rust selector accepts `wiki.md` beneath any relative `wiki` folder component, including nested folders, or a note with `cssclasses: [vault-wiki-direct]`. Ordinary notes, including notes with only `layer: wiki`, and unsupported profiles are not applicable. A selected Wiki target without frontmatter is **Incomplete**.

Only the current note is read. The text rules check the preamble, facts, table of contents, heading anchors and source-inventory tables. Findings retain upstream rule IDs and messages and open the note without fabricated line numbers or severity. Errors, timeouts, cancellation and snapshot changes remain **Incomplete**. The check does not verify real source files, shortcut destinations or folder targets and is not full ViggObsidian validation. No notes are changed.

The Wiki engine has separate [source](vendor/wiki-provenance.json) and [WASM](vendor/wasm/wiki-provenance.json) pins. Portable v2 capture leaves selection, body normalization and recognized knowledge-owner notice preprocessing in shared Rust. Obsidian supplies frontmatter boundaries and YAML parsing from the same captured text; this does not claim full native YAML or filesystem eligibility parity. The existing Work engine has its own unchanged pin.

## Privacy and installation

Processing stays in a local browser Worker with embedded Rust/WASM engines. No network, telemetry, external files, subprocesses, helper installation or downloader. Explicit rule/profile selections are saved through Obsidian's plugin settings API. No automatic scanning.

Install **ViggVault** from Obsidian's Community plugins catalog and enable it. See the [Community listing](https://community.obsidian.md/plugins/vigg-vault).

For manual installation, download `main.js`, `manifest.json` and `styles.css` from the [0.2.0 release](https://github.com/viggomeesters/obsidian-vigg-vault/releases/tag/0.2.0), place them in `<vault>/.obsidian/plugins/vigg-vault/`, then enable ViggVault. Preserve any existing `data.json`. macOS arm64 Obsidian desktop 1.15.0 is the verified host; mobile and other app platforms are unverified.

## Build and check

Production bundling requires Node and npm only. Version 0.2.0 was built locally with Node 25.8.0 on macOS arm64. The earlier Node 24.21.0/Linux x86_64 build evidence belongs to [0.1.1](docs/verification.md), not a new 0.2.0 Linux build. Both pinned WASM assets are committed with their digests, source files, lockfiles and canonical build provenance; no Rust compiler or network fetch is needed during bundling after `npm ci`.

```sh
npm ci
npm run build
```

To verify the engines from source, use Rust 1.92.0 and its wasm32-unknown-unknown target (rust-toolchain.toml):

```sh
npm run build:wasm
npm run build:wiki-wasm
npm run check:wasm
cargo build --locked --manifest-path vendor/link-style-core/Cargo.toml --target-dir build/rust
cargo build --locked --manifest-path vendor/wiki-layout-core/Cargo.toml --target-dir build/wiki-rust
npm run check
npm run check:privacy
```

For additional native Rust checks, run `cargo test`, `cargo fmt -- --check` and `cargo clippy --all-targets -- -D warnings` against each vendored crate's manifest, preserving its lockfile and using the corresponding target directory.

`build:wasm` writes only to build/rust; `build:wiki-wasm` writes only to build/wiki-rust. Neither overwrites a pinned asset. `check:wasm` compares both outputs byte-for-byte with the committed assets on the canonical macOS arm64 toolchain. The earlier Work engine investigation found different raw WASM bytes from Linux x86_64 with the same Rust version; no cross-host Rust byte-identity is claimed. Native/WASM behavior is checked separately. Production `npm run build` embeds the exact committed assets without recompiling Rust.

The Rust launchers remap HOME, Cargo cache and checkout roots to generic `/build/` paths through rustc's `--remap-path-prefix`, use Cargo's encoded flags and retain the 256 MiB memory limit. `check:privacy` verifies asset and source digests, checks the raw assets and actual decoded bundle payloads, and requires them to match. See the [Work WASM provenance](vendor/wasm/provenance.json) and [Wiki WASM provenance](vendor/wasm/wiki-provenance.json).

The optional actual-host proof requires explicit absolute `VIGGVAULT_TEST_ROOT` (the designated `obsidian-test-vault`), `VIGGVAULT_PRIVATE_TMP` (a private `.tmp` directory) and `VIGGVAULT_HOST_EVIDENCE` (a child of that directory), then `node tests/host-proof.mjs`. It uses the Obsidian CLI without OS focus control and restores settings, the active note and its fixtures. Never point this proof at a personal vault.

[Architecture and limits](docs/architecture.md), [Work source provenance](vendor/provenance.json), [0.2.0 local verification stage history](docs/verification-0.2.0.md), [retained 0.1.1 verification history](docs/verification.md).

MIT. Rust engines by Viggo Meesters are vendored unchanged from ViggObsidian at their recorded revisions; the MIT license is retained in vendor/LICENSE. Rust dependency notices are recorded in THIRD-PARTY-NOTICES.md. TypeScript, Obsidian typings, esbuild and lint tools are development-only and are not bundled as runtime libraries.
