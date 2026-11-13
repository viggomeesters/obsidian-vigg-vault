# ViggVault

Read-only Obsidian plugin powered by the ViggObsidian Rust engine. Version 0.1.0 is being prepared for its first public release. Community listing is pending.

## Use

Enable **Work link-style rules** in ViggVault settings. The rules are off by default because direct wikilinks, source labels and Wiki metadata conventions may differ from your vault. No personal vault paths or configuration are required.

Run **Check current note link style**, **Check current folder link style** (includes subfolders), or **Check vault link style** from the command palette. The findings view shows scope, completion status, path, line, rule and suggested presentation. Click a finding to navigate. **Cancel check** stops capture/evaluation. Nothing applies suggestions or edits notes.

All scopes read the full visible Markdown inventory for resolution, including note titles. Hidden paths are excluded; 90-templates is skipped. Only selected targets are checked. Snapshot changes, limits, cancellation and errors show **Incomplete**. A completed check covers only this Work link-style rule set, not full ViggObsidian validation. Results are a snapshot; rerun after edits.

## Privacy and installation

Processing stays in a local browser Worker with an embedded Rust/WASM engine. No network, telemetry, external files, subprocesses, helper installation or downloader. Only the explicit rule opt-in is saved through Obsidian's plugin settings API. No automatic scanning.

The canonical repository is [viggomeesters/obsidian-vigg-vault](https://github.com/viggomeesters/obsidian-vigg-vault). Once 0.1.0 is published, download `main.js`, `manifest.json` and `styles.css` from its [0.1.0 release](https://github.com/viggomeesters/obsidian-vigg-vault/releases/tag/0.1.0), place them in `<vault>/.obsidian/plugins/vigg-vault/`, then enable ViggVault. Preserve any existing `data.json`. These are manual installation instructions; Community installation becomes available only after catalog approval. macOS arm64 Obsidian desktop 1.15.0 is the verified host; mobile and other platforms are unverified.

## Build and check

Requires Node 25.8.0, Rust 1.92.0 and the wasm32-unknown-unknown target (rust-toolchain.toml). Build output stays local.

```sh
npm ci
npm run build:wasm
cargo build --locked --manifest-path vendor/link-style-core/Cargo.toml --target-dir build/rust
npm run check
npm run check:privacy
cargo test --locked --manifest-path vendor/link-style-core/Cargo.toml --target-dir build/rust
cargo fmt --manifest-path vendor/link-style-core/Cargo.toml -- --check
cargo clippy --locked --manifest-path vendor/link-style-core/Cargo.toml --all-targets --target-dir build/rust -- -D warnings
cargo audit --file vendor/link-style-core/Cargo.lock
```

The portable npm build launcher remaps HOME, Cargo cache and checkout roots to generic `/build/` paths through rustc's `--remap-path-prefix`. It supplies Cargo's encoded flags directly, preserving spaces without shell-specific environment syntax, and retains the 256 MiB memory limit. It deliberately uses the reviewed release flags rather than caller `RUSTFLAGS`. `check:privacy` checks both raw WASM and the payload decoded from the actual bundle and requires them to match.

The optional actual-host proof requires explicit absolute `VIGGVAULT_TEST_ROOT` (the designated `obsidian-test-vault`), `VIGGVAULT_PRIVATE_TMP` (a private `.tmp` directory) and `VIGGVAULT_HOST_EVIDENCE` (a child of that directory), then `node tests/host-proof.mjs`. It uses the Obsidian CLI without OS focus control and restores settings, the active note and its fixtures. Never point this proof at a personal vault.

[Architecture and limits](docs/architecture.md), [vendored provenance](vendor/provenance.json), [verification](docs/verification.md).

MIT. Engine and platform adapter by Viggo Meesters, vendored unchanged from ViggObsidian at the recorded revision; the MIT license is retained in vendor/LICENSE. Rust dependency notices are recorded in THIRD-PARTY-NOTICES.md. TypeScript, Obsidian typings, esbuild and lint tools are development-only and are not bundled as runtime libraries.
