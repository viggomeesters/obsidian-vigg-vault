# Architecture

The [product/engine boundary](product-engine-boundary.md) defines ViggVault as the user-facing product and ViggObsidian as its canonical Rust engine and native package source. Both remain maintained; local writer authority and stable interfaces are preserved.

Explicit Obsidian commands and opt-in settings capture through the Vault API, then use a dedicated browser Worker and separately pinned upstream Rust/WASM engines. Work captures the complete visible Markdown inventory; Wiki captures only the current note and its frontmatter from the same read. No native executable, fetch, telemetry or note writes. Version 0.1.1 is public, officially reviewed and verified through a fresh Community catalog installation on macOS arm64.

The Work rule set is off by default. Opt-in applies its existing conventions in any vault without private paths. Note/folder scope selects validation targets while retaining full-vault link resolution. Folder includes descendants. Hidden Markdown paths are excluded by the upstream contract; 90-templates is skipped. All visible Markdown content is read even for note scope. This is necessary for the existing rule engine's title and resolution semantics, and subject to its global limits.

For Work, a complete result means its link-style rules evaluated the captured inventory. For Wiki, it means only the selected current note’s Wiki text rules evaluated its captured body; it is not full ViggObsidian validation. Findings are rule kinds, not severity labels. Snapshot changes, timeouts, cancellation, failed capture, invalid results and worker errors remain incomplete; no clean report survives a failed run. Vault API observations are not an atomic filesystem snapshot. Work navigation uses captured path/line. Wiki navigation opens the note without a fabricated line or severity; edits after a result require a new check.

Limits inherited unchanged: 10,000 visible Markdown notes, 1 MiB per note, 16 MiB total content, 24 MiB request, 10-second capture/evaluation deadline, 256 MiB maximum WASM memory. The findings view renders at most 100 issues per page and always shows the full result count; previous/next controls page through the captured results.

## Current-note Wiki slice

The Wiki profile is off by default; the supported explicit choice is numbered-v1. Obsidian getFrontMatterInfo and parseYaml process the exact captured text, not cached metadata. The portable v2 request supplies the body, relative note path, typed cssclasses and required frontmatter-presence flag. The canonical Rust selector accepts `wiki.md` beneath any relative `wiki` folder component, or `vault-wiki-direct` in cssclasses. Only `layer: wiki` does not select a note. Ordinary notes and unsupported profiles return not applicable; a selected target without frontmatter is incomplete. Body line normalization and recognized knowledge-owner notice preprocessing share native Rust behavior. Platform YAML parsing does not claim full native YAML or filesystem eligibility parity.

Wiki reports retain upstream code/message and note navigation. They check preamble/facts/TOC/anchors/source inventory text only, never real source, shortcut or folder targets. Wiki capture is limited to 1 MiB and 10 seconds, with the same 256 MiB WASM memory cap. Cancel, timeout, drift, invalid results, read failure and Worker failure return incomplete; unload aborts and cleans Workers, timers and subscriptions. Work’s inventory, limits, pinned sources and rule behavior remain unchanged. Settings retain the existing workRules key and unknown saved keys.

Historical 0.1.1 evidence remains separate. Version 0.2.0 verification is recorded in verification-0.2.0.md and its completed release/catalog evidence in publication-0.2.0.json.

## Current-note Activity slice

The separately opted-in numbered-v1 Activity profile captures only the current note, its frontmatter-presence flag, body and three metadata fields: cssclasses, activity_format, activity_contract. Obsidian YAML parsing/boundaries come from that same read; no cached metadata or local provider configuration enters the request. Rust owns contract selection, text checks and line-ending normalization. Protocols are viggobsidian.activity-snapshot.v1 / viggobsidian.activity-result.v1 with activity-text.v1. Complete reports must advertise every required capability or the host rejects them as Incomplete.

The canonical upstream activity-core contains existing chat-v1, provenance-v1, Event v1.1 Activity-tail, mail-draft/delivery and human-input checks. The native CLI uses those same functions through reexports. Work/Wiki source pins and WASM bytes are preserved. Marker-free historical notes are not applicable; unknown activity_contract values retain the native finding. A selected profile without frontmatter, missing fields, unsupported schemas, failed capture or budgets is Incomplete. Host YAML parsing does not claim exact native unique-key/parser semantics.

This validates formal text only: no author identity or completed action is proven. Event headers/cards, Back/Finder/dossier paths, Raw task classification and source existence remain native-only. Note navigation uses upstream path/code/message; no line or severity is invented. Body/request limits are 1 MiB / 8 MiB; over 100 findings is Incomplete instead of truncated success. The Worker is terminated on cancellation, unload or the 10-second capture/evaluation deadline. This also bounds the inherited potentially quadratic provenance scan; an actual near-limit many-bubble Worker timeout is tested.

The Activity WASM ABI is activity_request_buffer/activity_validate/activity_response_buffer. Distinct names permit linking the unchanged link-style-core Markdown visibility helpers; legacy link-style ABI symbols may be present but are never called by the Activity Worker. Build/provenance/privacy checks cover all three raw and decoded embedded modules, full Activity sources and lock/build inputs, zero imports and 256 MiB memory caps.

TS/JS additions are limited to src/main.ts/src/vendor.d.ts (mandatory Obsidian interface), src/activity-adapter.mjs and src/activity-worker.mjs (Vault capture/Worker boundary), scripts/build-activity-wasm.mjs plus existing bundler/privacy configuration, and Activity/host platform tests. All Activity rule logic remains byte-exact upstream Rust. Native Rust helpers/builds would not replace these mandatory Obsidian/WebAssembly interfaces. No new registry dependencies or lock versions are introduced; the existing Work dependency/license closure covers Activity.

## Language and dependencies

All reusable rule logic and Wiki target selection live in the pinned upstream Rust crates. TypeScript in src/main.ts is the required Obsidian Plugin/ItemView/Settings/Editor interface and defensive host-response validation. src/vendor.d.ts declares that bridge. esbuild.config.mjs and eslint.config.mjs are required JavaScript tool configuration. tests/*.test.mjs exercise the actual JavaScript Worker and Obsidian-platform boundary; no duplicate rule algorithm exists in JS. Independent Rust CLI/build orchestration was considered but would add another distribution tool without reducing the mandatory JS boundary.

Rust 1.92.0 and wasm32-unknown-unknown are pinned; Cargo.lock preserves upstream dependency versions, pruned to each standalone crate. package-lock.json pins the Obsidian typings, official ESLint plugin, TypeScript and esbuild build-only dependencies. Runtime dependencies are only the host Obsidian API and embedded WASM. Production bundling requires Node/npm and embeds vendor/wasm/link_style_core.wasm and vendor/wasm/wiki_layout_core.wasm, whose digest and full Rust source/build provenance are recorded alongside it. Explicit build:wasm regenerates only build/rust; check:wasm verifies canonical macOS arm64 reproduction without overwriting the pinned asset. Rust builds on Linux x86_64 differ at the binary level, while the production Node bundle is independent of that host difference. Installing dependencies and regenerating Rust can require network access; bundling after npm ci and the plugin runtime do not.

Vendored engine, worker and adapter are provenance-pinned byte-for-byte. Their boundary is experimental, not a public SDK. The bundler embeds worker source and WASM into main.js; no extra runtime assets or own downloader are needed. The adapter's default module-worker factory is always overridden by the plugin's Blob-worker factory; import.meta.url is replaced at bundle time with a non-network sentinel only for that unreachable default. Source remains untouched.

Desktop-only plugin. Browser Worker behavior and a fresh Community catalog installation are exercised in Obsidian desktop 1.15.0 on macOS arm64. Mobile, other OSes, alternate app versions and pop-out windows are not verified. The declared minimum version 1.13.1 is API-based and has not been run as a separate host.

## Official references checked 13 November 2026

- https://github.com/obsidianmd/obsidian-api (ItemView, Plugin, Vault, Editor, declarative setting definitions; Context7 and installed 1.13.1 typings)
- https://docs.obsidian.md/community-directory/developer-policies (offline/privacy, no self-updaters, licenses)
- https://docs.obsidian.md/Reference/Manifest (version/platform/name/ID constraints)

The initially requested ViggObsidian name/ID contains the prohibited Community substring 'obsidian'. Final identity follows the separately recorded user naming choice.

The user chose **ViggVault** on 13 November 2026; the approved catalog ID is `vigg-vault`. ViggObsidian remains the upstream engine and package source. Version 0.2.0 adds the opt-in current-note Wiki text slice alongside Work link-style rules; it does not replace the native CLI, package transactions or authorized vault writers.

The Rust build-only `tools/retain_licenses.rs` preserves original dependency license/copyright files. The esbuild boundary embeds those notices in main.js so the three-file manual installation retains them too. Artifact tests verify provenance hashes, notices, zero WASM imports and the maximum memory bound.

The SDK's development-only moment 2.29.4 dependency is overridden to ^2.31.0 to avoid its old advisory range. The plugin never calls moment and leaves Obsidian external; the host supplies its own API/runtime. ESLint 9.39.5 is the last peer-compatible version for the official plugin 0.5.1 dependency chain but npm marks it unsupported. ESLint 10.14.0 was tested and rejected due to transitive peer constraints. npm audit reports 10 moderate development-tool advisories; production audit reports zero. Updating that lint dependency chain remains open. No forced major downgrades or broad overrides were used.
