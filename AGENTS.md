# Repository workflow

GitHub Issue → branch → PR → local validation and independent review. No GitHub Actions. Public release and Community catalog installation are separate phases; report only verified state. Publication, releases and catalog submissions require explicit authorization.

Own rule logic remains upstream Rust. TypeScript/JavaScript is limited to the required Obsidian, Worker, npm/Cargo build and platform-test interfaces. The portable build launcher and artifact privacy checks are part of that build boundary, not product logic. The vendored rule engine and adapter must remain byte-identical to the revision in vendor/provenance.json. Never add writes, helpers, downloads or automatic scans to the plugin. Test only the explicitly designated Obsidian test vault; preserve other settings and fixtures.
