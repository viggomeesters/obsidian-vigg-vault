# Release candidate verification — 13 November 2026

ViggVault 0.1.0 / minAppVersion 1.13.1. This document records local candidate evidence. Public release, Community submission and catalog installation remain separate pending steps.

## Local validation

- Clean npm ci; TypeScript and official Obsidian ESLint pass. Node 25.8.0 / npm 11.11.0, Rust 1.92.0 / wasm32-unknown-unknown, ESLint 9.39.5 / eslint-plugin-obsidianmd 0.5.1 / TypeScript 5.9.3 / esbuild 0.28.2.
- Twelve JS platform/artifact tests pass: three actual bundled-plugin tests, five real Worker/adapter tests including six native/WASM parity cases, provenance/license and WASM-boundary checks, plus two privacy tests. The privacy regression proves that a base64-only private path passes a surface-text check but fails after decoding the actual WASM payload; sanitized paths pass.
- Ten unchanged upstream Rust unit tests pass. Locked standalone native and WASM builds, fmt and Clippy with denied warnings pass. Cargo audit passes against the fetched advisory database. WASM imports zero host functions and memory growth above 256 MiB is rejected.
- Production npm audit: zero advisories. Full development audit: ten moderate tool-chain advisories. The unsupported ESLint 9 peer-compatible dependency chain remains an open development-tool limitation.
- Rust-policy extension gate passes against the pre-change baseline with exact justified npm/Cargo build, artifact and actual-host test interface exceptions. Semantic review keeps product rule logic entirely in unchanged, provenance-pinned Rust. No new dependency was added.

## Artifact privacy and build reproducibility

The production command `npm run build` compiles WASM, bundles the plugin and runs artifact privacy checks. It works from a fresh tracked-source copy after npm ci, without pre-existing build artifacts. The portable Node launcher uses Cargo's encoded Rust flags rather than shell environment-prefix syntax, remaps HOME/Cargo cache/checkout paths to generic build roots and retains the 256 MiB cap. Raw WASM and the payload decoded from the actual main.js must match and pass private-path checks. Provenance hashes remain unchanged.

Official build references: [rustc path remapping](https://doc.rust-lang.org/rustc/command-line-arguments.html#--remap-path-prefix-remap-source-names-in-output), [Cargo encoded flags](https://doc.rust-lang.org/cargo/reference/environment-variables.html). No path obfuscation or post-build binary substitution is used. Source-level panic locations stay readable under generic build roots.

Rebuilding in a separate checkout with spaces in its path produces byte-identical main.js and standalone WASM. Exact hashes are also recorded in docs/release-evidence.json. These are local reproducibility observations with the pinned toolchain, not a guarantee for all platforms or future compiler versions. Community review's build environment has not been executed here.

## Actual desktop host

The exact sanitized bundle was manually installed in the designated test vault. tests/host-proof.mjs uses actual Obsidian commands/API, Rust/WASM in a browser Worker and an isolated fictional fixture namespace. It requires explicit caller-supplied test/evidence roots, checks the actual vault root before app mutation and refuses an existing fixture namespace. Evidence stays in the caller's private .tmp directory. No mouse, keyboard or OS focus control is used.

Passed: rules-disabled gate; current-note scope checks 1 note; recursive folder checks 2 notes; visible vault inventory checks 52 notes; finding rule/line and cursor navigation; cancellation reports incomplete; synthetic read failure reports incomplete; rerun recovers; fixture Markdown stays byte-equal; unload/reload and persisted false opt-in; actual declarative setting toggle rendered and exercised. Settings data, active note and unrelated plugins are restored; fixtures are removed. Success is recorded only after cleanup assertions pass.

CLI eval returns before longer async jobs settle on this host. The driver waits for explicit private success/failure files with a 60-second bound. Internal app/Electron inspection is test-only; the distributed plugin uses public Obsidian APIs. Private screenshots and test-vault notes are not committed. No new user-interface copy was introduced by release preparation.

Actual app version: Obsidian 1.15.0 (installer 1.12.7), macOS arm64. The minimum version follows the public API/typings contract and was not executed as a second host. Other OSes, mobile, pop-out windows and catalog installation are unverified. Work link-presentation rules only; no full-validator claim. Snapshots are non-atomic; hidden paths are outside inventory.
