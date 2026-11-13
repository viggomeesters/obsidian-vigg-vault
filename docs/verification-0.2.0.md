# Verification — 0.2.0

Version 0.2.0 is public and officially approved. Its full Community review reproduced the published main.js byte for byte. Both an upgrade from 0.1.1 through Obsidian's own installer and a fresh Community catalog installation were observed, with settings preserved; the full actual-host proof passed again on the catalog-installed payload. The [publication record](publication-0.2.0.json) is the current delivery evidence. The local-candidate observations below are retained as stage history.

On 13 November 2026, candidate `03723ad15afb888d5b0cea606ffb0b172b9ba444` passed independent source review and the actual private host proof. Its runtime code is from `82ef1e45ac05e2620d7148e533ae598c69a25847`; the later commit changes only the host test. The exact tested `main.js` SHA256 is `2bb0047ac0a544f87076ef2939dabf2c2467772202a74a352f63156e448cbd30`.

At that local-candidate stage, official source preview, public release and Community installation were still pending. Those gates have subsequently passed, as recorded separately above. The accepted 0.1.1 history remains in [verification.md](verification.md), [release-evidence.json](release-evidence.json) and [publication-0.1.1.json](publication-0.1.1.json). Machine-readable historical local evidence is in [release-evidence-0.2.0.json](release-evidence-0.2.0.json).

## Engine, build and tests

The Wiki engine is pinned to public ViggObsidian [v0.25.2](https://github.com/viggomeesters/viggobsidian/releases/tag/v0.25.2), revision `10d288f8bc7ec055d6e14fa8988507327b3a717d`. Portable request v2 shares target selection, line normalization and recognized knowledge-owner notice preprocessing with the native Rust adapter; response v1 retains upstream codes/messages without invented line numbers or severity. Required frontmatter presence prevents a selected target without metadata from appearing complete. The existing Work engine, adapter and pinned WASM remain unchanged.

Passed locally: 225 locked upstream Rust workspace tests, rustfmt, Clippy with warnings denied, TypeScript typecheck, official Obsidian lint and 21 JavaScript platform tests. Actual native/WASM fixture parity covers v1 compatibility, v2 selection, notices, malformed/missing inputs, ordinary notes and unsupported profiles. The platform tests cover malformed responses, read/Worker errors, drift, cancellation, timeout and unload cleanup. Both import-free WASM modules enforce the 256 MiB memory maximum. Canonical macOS arm64 Rust builds reproduce both pinned assets; artifact source pins, embedded bytes, licenses and privacy checks pass. Production bundling embeds the committed assets using Node/npm. No cross-host Rust byte-identity claim is made.

## Actual private host proof

The exact candidate was loaded in the designated test vault on Obsidian 1.15.0, macOS arm64. The successful proof covered existing Work note/folder/vault checks, cursor navigation, cancellation, read failure and recovery; Wiki opt-out, ordinary/layer-only notes, nested and direct targets, exact engine code/message, note-only navigation, unsupported profile, missing/malformed frontmatter, read failure, drift, cancellation, recovery, unload and persisted settings. A valid BOM/CRLF Wiki with the recognized knowledge-owner notice produced no text findings.

Raw fixture bytes, API text, saved settings, the original active note and unrelated enabled plugins were preserved; temporary fictional fixtures were removed. The successful result is recorded after cleanup assertions. Source-plugin screenshots and screen text were inspected independently; Wiki labels/statuses use the existing English interface style and correct finding singular/plural. Private raw logs, screenshots and failed diagnostic attempts are retained outside the public repository.

Earlier failed host attempts exposed two test faults. Obsidian's Vault.read removes the BOM while preserving the raw file bytes; the proof now compares raw bytes with the original input and API text before/after separately. The original global drift injector also emitted a delayed second synthetic modify during recovery; the injector now emits exactly once for the selected fixture, requires snapshot_changed, then requires one immediate successful recovery without retry or sleep. These failed attempts remain preserved and are not counted as passes.

The host test waits 4.5 seconds only before the Wiki screenshot so an earlier opt-out Notice can expire. This does not change runtime behavior or recovery timing.

## Limits and subsequent publication

Wiki completion covers only the current selected note's text slice. It does not verify real filesystem classification, shortcut/source/folder targets or full ViggObsidian validation. Obsidian YAML parsing is a platform boundary. Mobile, other OS runtimes, minimum-version runtime and pop-out windows remain unverified.

The source preview completed with Dependencies Pass only; it did not provide build-verification evidence. The subsequent full release review passed Network, Vault Read, Dependencies and Build Verification, with no errors or warnings and two non-blocking recommendations: artifact attestations and vault enumeration. No Actions were added for the attestation recommendation.

The release uses exact tag `0.2.0` at `d5ba5e8f597f5551917b1c36920ed45505ce6d37`. Anonymous assets match the reviewed hashes. Installed main.js matches the entire release plus only Obsidian's exact 18-byte newline/nosourcemap suffix; full installed SHA256 is `c93f6f41dc6cfa1112c31fcb48adccfed13f0b2d41a5af0952df895ccc6dfd68`. Manifest and CSS are byte-identical. The fresh catalog installation followed proved absence of the plugin, manifest, enabled ID and directory; only existing settings were restored, never manual release files. The CLI refuses installation over an existing plugin, so the separate upgrade proof used Obsidian's own installer after resolving the official catalog entry and release manifest. The failed CLI and module-require attempts remain private diagnostics and are not counted as successful update proof.

All catalog-install preflight checks pass against the exact release candidate, with deliveryComplete=true. Local/host/review/channel records remain identified as supplied evidence; the checker does not itself repeat those tests or certify them independently. Actual observations and independent review establish the delivery result. Existing source/release history remains immutable.
