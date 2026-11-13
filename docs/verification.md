# Verification — 13 November 2026

Version 0.1.1 is public, independently reviewed and officially approved. Its complete release review reproduces the published main.js byte for byte. The public Community listing shows version 0.1.1 and Review Passed. A fresh Community catalog installation and actual runtime are verified on macOS arm64. The earlier 0.1.0 review reported a build-output mismatch; its source, tag and assets remain unchanged.

## Publication acceptance

Release source `6741e2d07ce51c28d70bc48231f05bb3aae5a020` is the exact commit reviewed locally, in the official branch preview and in the complete release review. Lightweight tag `0.1.1` names that commit. All three anonymous release downloads match the reviewed hashes. The public-release preflight passes; its claim is limited to a verified public GitHub release, not catalog installation.

The official branch preview completed with Dependencies Pass and no errors; it did not supply a build-verification result. The subsequent complete 0.1.1 release review reports Network, Vault Read, Dependencies and Build Verification Pass, explicitly reproducing main.js byte for byte. Its remaining recommendations concern artifact attestations and vault enumeration. Enumeration is disclosed for link resolution; GitHub Actions were not added for the optional attestation recommendation.

On 13 November the new ID propagated into the official app registry with the correct repository. In the designated test vault, the existing manual plugin was backed up and uninstalled through the official Obsidian CLI. The app then confirmed no loaded plugin, manifest or enabled ID, and the plugin directory was absent. `plugin:install id=vigg-vault enable` performed the fresh Community installation of 0.1.1; release files were not copied into the installed plugin directory. The existing settings alone were restored.

Installed manifest.json and styles.css match the anonymous release bytes. Installed main.js matches the exact release plus Obsidian's observed 18-byte `\n/* nosourcemap */` suffix; its full SHA256 is c2b61f2b2a4bc2f54803a7adcc84fda5f49939205c9880384e2a422c2ed227f5. The release-byte prefix retains SHA256 670a2f79264295a271d1a797d2247f8f6774413a5f05474dc0001b9635d34845. The existing actual-host proof was rerun successfully on this installed payload, including cleanup. Settings, active note and unrelated enabled plugins match the before state. The catalog-install phase passes against an isolated exact release-source checkout; supplied channel/runtime evidence remains identified as supplied evidence. Issue #1 tracks publication acceptance; developer-tool advisories remain separately in issue #2. Current phase evidence is in docs/publication-0.1.1.json.

## Reproduced difference

The same 0.1.0 source, locked dependencies and Rust/Cargo 1.92.0 produce different WASM on macOS arm64 and Linux x86_64. Both modules record the same rustc revision and LLVM 21.1.3. Memory/export/type/producer/target-feature sections match; function/code/data/name sections differ. JavaScript outside the embedded WASM is byte-identical, including the license banner. Node 24.22.1 and 25.8.0 on macOS also produce identical JavaScript.

| Rust build host | WASM SHA256 | main.js SHA256 |
| --- | --- | --- |
| macOS arm64 | fdabcccbdddfb3a77bb501925b42434f184cdfd1e4be213ee0fc0473f2773b2f | 670a2f79264295a271d1a797d2247f8f6774413a5f05474dc0001b9635d34845 |
| Linux x86_64 | e8b9fc994c93023ccb630fb766f7cde8f13a25b15ea850d767af3ed1450c8b0a | abd76467c38ebc549b69d020b3c43238111799f429ceeacde175a828d0227b36 |

Cargo fingerprints differ for dependencies with host build scripts and their consumers, while inspected build-script outputs, target/profile settings and toolchain revisions match. Host-dependent crate metadata is a supported explanation for the observed layout/order differences, not a proven account of the scanner's hidden environment. The official report exposes no build log or reference hash. Upstream context: [Rust cross-host WASM reproducibility discussion](https://github.com/rust-lang/rust/issues/117597).

## 0.1.1 build contract and checks

Production `npm run build` uses Node/npm only and embeds the committed canonical WASM asset. Its exact digest, Rust source/lock/config hashes, upstream provenance, license and canonical build platform are recorded in vendor/wasm/provenance.json. It never downloads or recompiles the engine. The explicit `build:wasm` command writes only build/rust; `check:wasm` verifies canonical macOS arm64 byte reproduction and never overwrites the pinned asset. Linux source builds remain available for investigation, without a cross-host raw-WASM byte-identity claim.

- Fresh-source macOS and Linux Node production builds produce the same main.js, manifest.json, styles.css and pinned WASM hashes recorded in docs/release-evidence.json. Bundling passes with a PATH containing only Node, npm and the system shell, without access to Cargo/Rust. Linux Node 24.21.0 / npm 11.19.0; macOS Node 25.8.0 / npm 11.11.0.
- Canonical Rust 1.92.0 source regeneration equals the pinned fdab… asset. All eight existing upstream provenance byte pins remain unchanged. No Rust source or runtime JavaScript changed; main.js remains identical to the previously audited 0.1.0 payload.
- Thirteen JS tests pass: actual bundled-plugin behavior, real Worker/native parity for complete and invalid snapshots, capture/mutation/cancel/error cleanup, pagination, notices/provenance, zero WASM imports, the 256 MiB maximum, raw/decoded artifact privacy and a new corruption regression rejecting changed engine bytes against the pin. TypeScript and official Obsidian ESLint pass.
- The unchanged engine's prior ten Rust tests, fmt, Clippy and Cargo audit remain applicable; the canonical source build was rerun for this candidate. No dependency changed. Production npm audit previously reported zero advisories; the existing ten moderate development-tool advisories and unsupported ESLint 9 dependency chain remain open limitations.
- Rust-policy gate passes against the pre-change baseline with exact mandatory esbuild/artifact/platform-test interface exceptions. No product logic moved out of Rust. License banner text remains unchanged. No GitHub Actions, metadata hacks, post-build substitution or runtime updater were added.

Official build references: [rustc path remapping](https://doc.rust-lang.org/rustc/command-line-arguments.html#--remap-path-prefix-remap-source-names-in-output), [Cargo encoded flags](https://doc.rust-lang.org/cargo/reference/environment-variables.html).

## Actual desktop host

Version 0.1.1's manifest and exact 670a… bundle were loaded in the designated Obsidian test vault. The CLI returns before asynchronous plugin reload finishes, so the host was checked for its actual root and loaded manifest version and recorded a private readiness marker before the proof began. An initial proof stopped before creating fixtures because reload had not finished; after the explicit ready check the full proof passed.

Passed: rules-disabled gate; current-note scope checks 1 note; recursive folder checks 2 notes; visible vault inventory checks 52 notes; finding rule/line and cursor navigation; cancellation reports incomplete; synthetic read failure reports incomplete; rerun recovers; source Markdown stays byte-equal; unload/reload and persisted false opt-in; actual declarative settings toggle. Plugin settings data, original enabled state, active note and unrelated plugins are preserved; fictional fixtures are removed. Success is recorded only after cleanup assertions pass.

Host: Obsidian 1.15.0 (installer 1.12.7), macOS arm64. Tests use the CLI and internal app/Electron inspection without OS focus, mouse or keyboard control. The plugin itself uses public Obsidian APIs. Private screenshots and raw logs are not committed. No interface copy changed.

The minimum version 1.13.1 follows the API/typings contract and was not executed as a second host. Other OS runtime behavior, mobile and pop-out windows remain unverified. Work link-presentation rules only; snapshots are non-atomic and hidden paths are outside inventory.
