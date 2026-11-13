# ViggVault product and ViggObsidian engine

Decision: 13 November 2026. Product plan: [#3](https://github.com/viggomeesters/obsidian-vigg-vault/issues/3). Contract implementation: [#4](https://github.com/viggomeesters/obsidian-vigg-vault/issues/4).

**ViggVault is the user-facing product and Obsidian interface. [ViggObsidian](https://github.com/viggomeesters/viggobsidian) remains the canonical Rust engine, package source and native CLI. Both are maintained.** ViggObsidian is not deprecated. Existing plugin IDs, CLI commands, package paths and provider/writer interfaces do not change because of this naming decision.

| Owner | Responsibility |
| --- | --- |
| ViggObsidian | One implementation of reusable Rust rules, profile/schema contracts, package assets, native checks and package transactions. |
| ViggVault | Explicit settings/commands, Obsidian capture, Worker/WASM integration, findings and navigation. No duplicate rule engine. |
| Existing local providers/writers | Authorized domain writes, claims, registries, queues and recovery. The plugin does not become a second writer. |

The engine and plugin have independent versions. Each plugin release pins an exact reviewed engine revision, protocol/schema version, WASM digest and license. Updates arrive through normal reviewed plugin releases; the plugin does not download replacement engines, install helpers or silently run a native CLI. Native package maintenance remains available independently of the plugin.

Rust owns rule behavior. TypeScript/JavaScript remains limited to the necessary Obsidian, Worker, build and platform-test interfaces. A reusable core must not depend on private vault data, external providers or filesystem/process handles. Native adapters retain filesystem and classification guarantees. Unknown protocol versions or missing required inputs cannot produce a clean result; findings, not-applicable notes and incomplete execution remain distinct. Locations are shown only when the engine actually supplies them.

Version 0.2.0 adds opt-in current-note Wiki-layout text checks through a separately pinned Rust engine and portable v2 capture protocol. Work link-style checks retain their existing pin and behavior. Canonical Wiki target selection and maintenance-notice preprocessing are shared upstream with the native adapter. Obsidian frontmatter/YAML capture does not attest to filesystem eligibility or full native YAML parity. Broader checks require separately reviewed engine and plugin slices. Profile-specific conventions are explicit choices, not requirements imposed on every vault. No full ViggObsidian validation, new platform support or native write capability follows from this decision.

Any future native bridge or write interface requires a separate design and authorization. Existing target-root binding, preview, preimages, drift rejection, locks and recoverable rollback remain mandatory; domain writer authority is never bypassed. The present plugin remains read-only and helper-free.

The engine keeps the same boundary in [its architecture record](https://github.com/viggomeesters/viggobsidian/blob/main/docs/product-engine-boundary.md). Technical work is owned by linked GitHub issues and PRs; this record states the durable architecture, not a second task tracker.
