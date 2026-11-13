# Repository workflow

Read docs/product-engine-boundary.md before architecture or feature changes. ViggVault is the product/Obsidian interface; ViggObsidian remains the canonical Rust engine, package source and native CLI. Keep both, preserve existing IDs/interfaces, and implement reusable rule logic upstream rather than creating a second engine here. An upstream extraction does not itself add a shipped plugin command. Local providers/writers keep their existing authority.

GitHub Issue → branch → PR → local validation and independent review. No GitHub Actions. Public release and Community catalog installation are separate phases; report only verified state. Publication, releases and catalog submissions require explicit authorization.

Use public noreply identities for both commit authors and committers. Verify the GitHub account's web-commit email/privacy settings before creating a public PR: local Git identity does not control GitHub's synthetic merge commits. When that metadata cannot be guaranteed safe, review in private staging and export only independently audited commits to public refs. Keep private review history private.

Own rule logic remains upstream Rust. TypeScript/JavaScript is limited to the required Obsidian, Worker, npm/Cargo build and platform-test interfaces. The portable build launcher and artifact privacy checks are part of that build boundary, not product logic. The vendored rule engine and adapter must remain byte-identical to the revision in vendor/provenance.json. Never add writes, helpers, downloads or automatic scans to the plugin. Test only the explicitly designated Obsidian test vault; preserve other settings and fixtures.
