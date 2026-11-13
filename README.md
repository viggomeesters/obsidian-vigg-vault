# ViggVault

Read-only Obsidian plugin powered by the ViggObsidian Rust engine. Version 0.1.1 is public and has passed Community review, including byte-for-byte reproduction of the released main.js.

ViggVault is the user-facing product; [ViggObsidian](https://github.com/viggomeesters/viggobsidian) remains the shared engine, package source and native CLI. Both are maintained, with one upstream rule implementation. See the [product/engine boundary](docs/product-engine-boundary.md).

## Use

Enable **Work link-style rules** in ViggVault settings. The rules are off by default because direct wikilinks, source labels and Wiki metadata conventions may differ from your vault. No personal vault paths or configuration are required.

Run **Check current note link style**, **Check current folder link style** (includes subfolders), or **Check vault link style** from the command palette. The findings view shows scope, completion status, path, line, rule and suggested presentation. Click a finding to navigate. **Cancel check** stops capture/evaluation. Nothing applies suggestions or edits notes.

All scopes read the full visible Markdown inventory for resolution, including note titles. Hidden paths are excluded; 90-templates is skipped. Only selected targets are checked. Snapshot changes, limits, cancellation and errors show **Incomplete**. A completed check covers only this Work link-style rule set, not full ViggObsidian validation. Results are a snapshot; rerun after edits.

## Privacy and installation

Processing stays in a local browser Worker with an embedded Rust/WASM engine. No network, telemetry, external files, subprocesses, helper installation or downloader. Only the explicit rule opt-in is saved through Obsidian's plugin settings API. No automatic scanning.

Install **ViggVault** from Obsidian's Community plugins catalog and enable it. The [Community listing](https://community.obsidian.md/plugins/vigg-vault) shows version 0.1.1 and Review Passed. A fresh catalog installation and runtime were verified on 13 November in Obsidian 1.15.0 on macOS arm64, after the new ID propagated into the app catalog.

For manual installation, download `main.js`, `manifest.json` and `styles.css` from the [0.1.1 release](https://github.com/viggomeesters/obsidian-vigg-vault/releases/tag/0.1.1), place them in `<vault>/.obsidian/plugins/vigg-vault/`, then enable ViggVault. Preserve any existing `data.json`. macOS arm64 Obsidian desktop 1.15.0 is the verified host; mobile and other app platforms are unverified.

## Build and check

Production bundling requires Node and npm only. Tested with Node 25.8.0 on macOS arm64 and Node 24.21.0 on Linux x86_64. The pinned WASM asset is committed with its digest, source files, lockfile and canonical build provenance; no Rust compiler or network fetch is needed during bundling after npm ci.

```sh
npm ci
npm run build
```

To verify the Rust engine from source, use Rust 1.92.0 and its wasm32-unknown-unknown target (rust-toolchain.toml):

```sh
npm run build:wasm
npm run check:wasm
cargo build --locked --manifest-path vendor/link-style-core/Cargo.toml --target-dir build/rust
npm run check
npm run check:privacy
cargo test --locked --manifest-path vendor/link-style-core/Cargo.toml --target-dir build/rust
cargo fmt --manifest-path vendor/link-style-core/Cargo.toml -- --check
cargo clippy --locked --manifest-path vendor/link-style-core/Cargo.toml --all-targets --target-dir build/rust -- -D warnings
cargo audit --file vendor/link-style-core/Cargo.lock
```

`build:wasm` writes only to build/rust and never overwrites the pinned asset. `check:wasm` compares that output byte-for-byte with the committed asset; it is a release gate on the canonical macOS arm64 toolchain. Linux x86_64 source compilation produces different WASM bytes with the same Rust version: no cross-host Rust byte-identity is claimed. Native/WASM behavior is checked separately. Production `npm run build` always embeds the exact committed asset, making the JavaScript artifact independent of the Rust build host.

The Rust launcher remaps HOME, Cargo cache and checkout roots to generic `/build/` paths through rustc's `--remap-path-prefix`, uses Cargo's encoded flags and retains the 256 MiB memory limit. `check:privacy` verifies asset and source digests, checks the raw asset and actual decoded bundle payload, and requires them to match. See [WASM provenance](vendor/wasm/provenance.json).

The optional actual-host proof requires explicit absolute `VIGGVAULT_TEST_ROOT` (the designated `obsidian-test-vault`), `VIGGVAULT_PRIVATE_TMP` (a private `.tmp` directory) and `VIGGVAULT_HOST_EVIDENCE` (a child of that directory), then `node tests/host-proof.mjs`. It uses the Obsidian CLI without OS focus control and restores settings, the active note and its fixtures. Never point this proof at a personal vault.

[Architecture and limits](docs/architecture.md), [vendored provenance](vendor/provenance.json), [verification](docs/verification.md).

MIT. Engine and platform adapter by Viggo Meesters, vendored unchanged from ViggObsidian at the recorded revision; the MIT license is retained in vendor/LICENSE. Rust dependency notices are recorded in THIRD-PARTY-NOTICES.md. TypeScript, Obsidian typings, esbuild and lint tools are development-only and are not bundled as runtime libraries.
