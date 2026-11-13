# Activity text verification — 0.3.0

Source-preview implementation stage, 13 November 2026. Engine owner: [#86](https://github.com/viggomeesters/viggobsidian/issues/86); plugin owner: [#6](https://github.com/viggomeesters/obsidian-vigg-vault/issues/6). Publication, official review and catalog installation are recorded separately once observed. These local checks alone are not delivery evidence.

The Activity core is byte-identical to public ViggObsidian 0.27.0 release `0faffb0f4e63d2efd9ef474016941b03d0594a61` (rule source `1d8aaf5f44e805c1e22793699d5db0478b3cf081`). Source/schema/capabilities/license hashes are in vendor/activity-provenance.json, canonical WASM and all source/build-input hashes in vendor/wasm/activity-provenance.json. The existing Work and Wiki vendor sources, assets and provenance are byte-identical to plugin base `5b3acb0ca42016a64f16382069023b4ccc3086af`.

Local macOS arm64 / Rust 1.92.0 checks:

- Engine workspace: 237 serialized Rust tests passed, including 23 Activity-core tests, exact frozen text outputs, 64 fictional native filesystem cases with source bytes preserved, and offline standalone package compilation.
- Engine fmt, Clippy with warnings denied, Rust policy and cargo-audit passed; 0 vulnerabilities/advisory warnings at the checked lock. No new registry dependency or selected dependency version.
- Actual upstream native/WASM parity: 3 tests passed, including 64 frozen human/agent/legacy/mail/Event combinations, malformed/unsupported/capture-limit parity and the actual 256 MiB memory maximum.
- Plugin `npm run check`: typecheck, lint and all 29 platform tests passed. Existing Work/Wiki regression tests remain included. Activity tests exercise actual native/WASM and Worker/capture boundaries, capability rejection, visible not-applicable vs findings vs clean, minimal metadata, malformed capture, read failures, cancellation, drift, unload and cleanup.
- Actual Worker timeout passed for a near-1-MiB many-bubble input using a short test deadline; the Worker terminates and returns Incomplete. Late reads create no Worker after cleanup. Production deadline remains 10 seconds.
- Canonical `build:wasm`, `build:wiki-wasm`, `build:activity-wasm` plus `check:wasm` reproduced all three committed modules byte for byte. Privacy checks inspect standalone and decoded embedded modules, source digests and bundle notices. Activity vendored Rust tests/fmt/Clippy passed.
- Rust policy checks the complete plugin diff against the original base, with exact-path exceptions only for required Obsidian/Worker/build/platform interfaces documented in architecture.md. All new reusable rule logic is upstream Rust.

Actual Obsidian host proof is a separate gate. tests/host-proof.mjs retains Work/Wiki regressions with the 0.3.0 version and three settings; tests/activity-host-proof.mjs covers explicit opt-out, valid human/agent/header/top-stamp/mail cases, chat legacy and Event Activity, ordinary skip, malformed/missing metadata, invalid authorship stamp findings, navigation, one drift followed by immediate recovery, cancel/read/unload, real Activity settings persistence/unknown-key preservation, raw source-byte preservation and cleanup. It requires the explicit designated test vault/private evidence roots. Screenshots and host results must be inspected before treating that gate as passed.

Formal provenance markers are only text syntax. This slice proves no identity, actual execution, Event header/Finder/dossier target, complete native strict check or new platform support. No runtime writer or native vault package rollout was performed by this implementation.
