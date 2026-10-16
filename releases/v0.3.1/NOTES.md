# RelayCrew 0.3.1

Organizes source into core, host, adapters, storage and UI, moves shared backlog contracts into core, preserves the VS Code entry point/identifiers and connects repository metadata to HiTranquility/RelayCrew.

Adds a versioned archive catalog, original historical packages, recovered historical source, checksums, a changelog and a tag/version-checked GitHub prerelease workflow. The local source snapshot includes tests, build scripts and the lockfile, but excludes dependencies, generated output, other release archives, secrets and Git history.

Validation: strict TypeScript check, 38 tests, build/package, preview generation and native VS Code host smoke passed on Windows. Tests include archive tamper detection and rejection of tags that do not match the source version. Dependency audit reported no vulnerabilities when checked. Live provider accounts and real Telegram/Zalo delivery have not been validated. GitHub workflows have not run remotely in this development session.
