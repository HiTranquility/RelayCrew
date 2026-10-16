# Release archives

Keep each version in its own immutable directory. Never replace an existing VSIX with a rebuild: even equivalent builds can produce a different ZIP checksum. Corrections belong in a new version.

| Version | Original package | Source provenance |
|---|---|---|
| [0.1.0](v0.1.0/NOTES.md) | `ai-team-workbench-0.1.0.vsix` | Partial source recovered from the packaged source map |
| [0.2.0](v0.2.0/NOTES.md) | `ai-team-workbench-0.2.0.vsix` | Partial source recovered from the packaged source map |
| [0.3.0](v0.3.0/NOTES.md) | `relaycrew-0.3.0.vsix` | Partial source recovered from the packaged source map |
| [0.3.1](v0.3.1/NOTES.md) | `relaycrew-0.3.1.vsix` | Source snapshot including tests, scripts and lockfile |
| [0.4.0](v0.4.0/NOTES.md) | `relaycrew-0.4.0.vsix` | Bilingual UI, daily management and project/worktree source snapshot |
| [0.5.0](v0.5.0/NOTES.md) | `relaycrew-0.5.0.vsix` | Live console, overview and task observation source snapshot |
| [0.6.0](v0.6.0/NOTES.md) | `relaycrew-0.6.0.vsix` | Real CLI setup, inline accounts, Markdown workflows, attachments and panel controls |
| [0.7.0](v0.7.0/NOTES.md) | `relaycrew-0.7.0.vsix` | Inline team/routing/quota/messaging configuration and primary-manager emphasis |

Each directory contains the exact VSIX, a source ZIP, `release.json`, `SHA256SUMS` and release notes. Run `npm run releases:verify` to verify every archived asset. These archives are retained in Git but excluded from the installed extension package. The original 0.1/0.2 package names are preserved; their display name was AI Team Workbench.

The older source ZIPs contain only original `src/` files recovered from `sourcesContent`, plus package metadata and any README/license shipped in that VSIX. They are **not full historical repositories**: tests, build scripts, lockfiles and Git history were not packaged and cannot be recovered by this process. The archive manifest records this limitation. Historical checks have not been rerun against those partial snapshots.

## GitHub release process

The local archives do not mean releases have already been published to GitHub. Current source is 0.7.0; do not point older tags at this source. GitHub's automatic source ZIP for such a tag would misrepresent those versions.

For a new source release:

1. Update `package.json`, `package-lock.json`, the changelog and `releases/vX.Y.Z/NOTES.md`.
2. Run check, tests, archive verification and packaging. Review and commit the source.
3. Create an annotated tag matching the manifest, then push the commit and tag. For the current source:

   ```sh
   git tag -a v0.7.0 -m "RelayCrew 0.7.0"
   git push origin main
   git push origin v0.7.0
   ```

4. The release workflow checks/tests the tagged source, verifies retained archives, builds a fresh VSIX, checks the tag/version match and publishes a GitHub **prerelease** with the VSIX and its SHA-256 checksum. It never publishes to the VS Code Marketplace. A duplicate release fails rather than replacing existing assets.

GitHub's generated source download represents the tagged commit. A CI-built VSIX may have different ZIP timestamps/checksums from the locally archived build; use the checksum supplied with the particular asset you download. The archived original is never replaced.

Preserve old builds here until their complete historical source/commits are available. If uploading a historical binary separately, explicitly label it as a binary archive and explain the source provenance; do not imply that current source is its original source.
