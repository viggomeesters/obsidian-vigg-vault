# Structure and navigation capabilities

Design owner: [#7](https://github.com/viggomeesters/obsidian-vigg-vault/issues/7),
within [product plan #3](https://github.com/viggomeesters/obsidian-vigg-vault/issues/3).
The first bounded engine proof is [ViggObsidian #92](https://github.com/viggomeesters/viggobsidian/issues/92);
its [contract and reproduction](https://github.com/viggomeesters/viggobsidian/blob/main/docs/structure-capabilities.md)
own the shared Rust implementation. **This design adds no plugin command or
WASM payload. ViggVault remains 0.3.0.**

Reviewed proof source:
[`fad6dd1`](https://github.com/viggomeesters/viggobsidian/commit/fad6dd1e8c55bc327a73c7fa5e8fc9e86d836af3).
Engine [0.27.1](https://github.com/viggomeesters/viggobsidian/releases/tag/v0.27.1)
is published at `1d3e592402b510595f919adc9d5ba3be09d21396`. Its
[package manifest](https://github.com/viggomeesters/viggobsidian/blob/v0.27.1/package.json)
pins that reviewed source and 112 independently checked files; the anonymous
manifest download matches SHA256
`2c3f5bb72a85c38d4500389c8cdd80a5aab955b1eef521e334621a3a219b35d7`.
This reference does not change the current plugin's engine pins or install the
native package in any vault.

The safe first slice is visible matching-entrance presence in one explicitly
selected fictional dossier. Broader structure rules require different inputs;
they must not be advertised as a single portable `--check-all`.

## Capability matrix from the actual native code

Inventory against engine base `52d5dd2780ab539aa0ad87cd9f4aa1d92959e530`.
All paths below are upstream `crates/vault-layout/src/`; filenames identify code
actually read, rather than assumed rule names. `numbered-v1` remains the only
canonical profile; local roots and exceptions are explicit adapter input, never
inferred from a user's arbitrary folder names.

| Slice and native owner | Minimal typed facts required | Visible Vault API can supply | Still native / acceptance before portability |
| --- | --- | --- | --- |
| Matching entrance, `main.rs` `Scan::note` / folder traversal (`folder-note`) | Explicit scope, selected folder paths, complete visible path/kind/parent inventory, chosen profile, stable capture generation | `TFolder.children`, `TAbstractFile.path/name/parent`, `TFolder` versus `TFile`; case-sensitive exact lookup | **First proof only:** visible presence. `symlink_metadata`, regular-file guarantees, filesystem errors and native traversal/exception eligibility remain native. |
| Program/project/component hierarchy, `main.rs` `folder_with_depth` / `layer`, `navigation_contract.rs` | Typed root roles, parent/child relations, parsed metadata/layer, strictness, profile and explicit exception/config versions | Visible folders and note bytes; parsed frontmatter through an explicit host boundary | Native root/profile discovery, hidden system policy, delegated/daily writer exceptions and filesystem classification. No extraction yet; never impose a new profile based on a folder name. |
| Wiki/Raw structure and shortcuts, `main.rs` `layer`, `check_dossier_profile`, `check_dossier_shortcuts`, `wiki_target`, `shortcut_links.rs` | Dossier role, explicit parent entrance, Wiki/Raw sibling paths, note body/classes, full target-resolution scope, exact ambiguity rules; Finder requires native root identity | Visible paths/kinds, note text and headings. Existing Wiki text-only command already works separately | Canonicalize/symlink rejection, native suffix/relative target resolution, direct-Wiki eligibility and Finder absolute filesystem target are not supplied by visible presence. Metadata-cache resolution is not a substitute. Separate extraction/parity needed. |
| Project/component codes and registry, `project_codes.rs` | Explicit code roots, project-month/code/stable ID, component code/ID, full chosen registry scope, folder names and child metadata | Visible inventory plus captured note metadata; no need to expose unrelated note contents | Current scan uses native canonicalization and schema-discovered roots; layout reserves `00` Project Wiki, uniqueness is closed-world. Do not claim global uniqueness from a selected dossier. Typed registry extraction is separate. |
| Source references / processing, `source_inventory.rs`, `raw_processing.rs`, `main.rs` metadata/wiki_target | Raw package and sibling inventory, source identity/path/hash, backbinding, Wiki target/anchor, related metadata/text, extract/original evidence | Visible note bytes, paths and text anchors may support future narrowly named consistency checks | Actual original/extract existence, canonical paths, hashes, local inventory authority and producer provenance need native evidence. A valid declared hash or marker does not prove source bytes or identity. |
| Navigation indexes, `index_navigation.rs`, `main.rs` navigation | Explicit index scope policy, selected entries, full link-resolution inventory/anchors, typed exclusions and daily-Base policy | Visible entries and texts are possible after separate capture-cost proof | Hidden scope policy, technical package exclusions, system assets and daily writer/Base contracts cannot be guessed. `--indexes` is not this slice. |
| Filesystem / installed package integrity, native scan and package CLI | Native root binding, regular file/symlink facts, hidden assets, installed identity and hashes, authorized local adapters | **No equivalent visible API capability** | Remains native. No AdapterAPI escape hatch, native helper, download or bridge is introduced by #7; #8 owns any later bridge decision. |

## What the API actually establishes

Obsidian's [Vault documentation](https://docs.obsidian.md/Plugins/Vault) explicitly
limits Vault API to files visible in the app; hidden folders require Adapter API.
The official [TypeScript API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)
provides `TAbstractFile.path/name/parent`, `TFolder.children`, `getRoot`,
`getAllLoadedFiles`, `getFiles` and case-sensitive `getAbstractFileByPath`.
`getMarkdownFiles` alone is insufficient: it cannot attest to empty folders,
non-Markdown assets or a folder conflicting with an expected `.md` entrance.
No regular-file or symlink fact is promised by those visible types.

A read-only probe on the existing local macOS Obsidian test host on 13 November
2026 observed 277 visible nodes: 207 files and 70 folders including root; unique
paths; consistent parent/child membership; no unknown node kinds. Case-mismatched
lookup returned no file, and a hidden application directory existing on disk
was absent through Vault lookup. Two inventories around one asynchronous yield
were equal, with no intervening captured event. This proves the observed API
shape on that host, **not an atomic snapshot, native eligibility, cross-platform
support or production capture implementation**. The probe read no note bodies,
wrote no vault files and left active note/leaf unchanged. Only these sanitized
aggregate observations belong in this public design; private probe data stays
outside the repository.

## First versioned slice and capture boundary

Engine protocol `viggobsidian.structure-snapshot.v1` selects ruleset/capability
`visible-folder-entrance.v1` and explicit profile `numbered-v1`. It carries a
visible relative scope, nonempty explicit selected folders, a complete visible
`{path,kind}` inventory including scope and ancestors, `complete:true`, and
matching `capture.before/after` tokens. Case and Unicode are literal. Portable
paths reject hidden/dot-leading components, traversal, backslash, colon, NUL and
paths above 1024 UTF-8 bytes; an unsupported actual path is Incomplete, never
silently normalized. New contracts must version any expansion.

The engine validates structural consistency and asserted generation equality;
only the host can attest enumeration completeness and freshness. Future capture
must subscribe before reading, keep generation through result delivery, copy
paths/kinds/parents, compare a second exact inventory and reject events, missing
parents, unknown kinds, duplicates/conflicts, changed scope or an unloaded
plugin. Discard stale results after Worker completion too. API event checks plus
double enumeration are deliberately not called an atomic filesystem snapshot.

Result `viggobsidian.structure-result.v1` distinguishes a completed named slice
(possibly with findings), not-applicable profile, and Incomplete with a reason
and no clean/partial report. Missing data is never equated with absence; absence
can be evaluated only inside an explicitly complete inventory. There is no
full-vault pass, severity or line location invented by the platform interface.

The frozen fictional dossier has a visible matching file, a missing Raw
entrance and a folder at a Wiki entrance path. The engine compares actual native
`Scan::note` diagnostics with the shared Rust snapshot core and genuine WASM.
Native symlink rejection stays separately tested and unclaimed in portable
results. This is diagnostic parity for the **same typed visible facts**, not
proof that a Vault `TFile` satisfies the native regular-file gate.

## Explicit limits and remaining host proof

The experiment caps request JSON at 1 MiB, paths at 1024 bytes, capture token at
128 bytes, inventory at 10,000 nodes, selected folders at 1,000, findings at 100
and WASM linear memory at 256 MiB. Over-budget input returns Incomplete;
findings are never truncated to success. Real native/WASM tests exercise the
maximum admitted inventory and selections below a 10-second local evaluation
budget, malformed/unsupported inputs and limits, and actual memory-growth
rejection. Bounded input and ordered indexes limit work without reading bodies.

A real Node Worker experiment proves success, changed-generation rejection,
injected timeout, explicit cancel and simulated unload using AbortSignal and
awaited termination, with no late successful report. It does not run the
Obsidian unload hook or browser Worker. A future product adapter needs one
10-second total deadline across capture and evaluation, event/listener cleanup,
actual browser Worker termination, response validation, and measured peak host
memory including inventory, JSON/message copies and WASM. The Node test's
64 MiB old-generation limit is not total RSS or an Obsidian/browser heap bound.

Only local macOS native and Node WebAssembly/Worker runtime are proven for this
prototype; the read-only Obsidian probe proves API shape only. Windows, Linux,
minimum supported Obsidian version, pop-out windows and mobile remain unproven.
No screen tests or wide-vault validation ran for this design.

## Execution ownership

[#92](https://github.com/viggomeesters/viggobsidian/issues/92) owns the minimal
shared diagnostic extraction and executable fictional proof. Its native adapter
delta needs normal engine review/release before distribution; adding this design
does not update ViggVault's current engine pins or installed vault packages.
There is no reason to release ViggVault 0.3.1 for documentation alone.

Before implementing a plugin command,
[ViggVault #9](https://github.com/viggomeesters/obsidian-vigg-vault/issues/9) owns
immutable visible-inventory capture and browser Worker lifecycle, with that
engine revision as dependency and the host/memory limitations above as explicit
acceptance. Review and prove capture first on the fictional dossier. Only then
decide a separate current-dossier command issue and any release. Other matrix
rows each need their own bounded engine owner issue for typed inputs/parity,
followed by dependent plugin integration. This design authorizes no broader
scan, writer, helper or bridge, and creates no bulk task register.

The next bounded engine designs are
[#93](https://github.com/viggomeesters/viggobsidian/issues/93) for project-code
layout and explicitly scoped registry facts, and
[#94](https://github.com/viggomeesters/viggobsidian/issues/94) for Wiki/Raw
shortcuts and typed target resolution excluding Finder/native filesystem
guarantees. All three follow-ups are backlog, with no automatic execution from
this design or proof. Existing #8 remains the separate native bridge owner.
