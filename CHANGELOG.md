# Changelog

Versions before 1.0 are early releases. See [release archives](releases/README.md) for exact packages, hashes and source provenance.

## 0.4.0 — 2026-10-16

- Add English/Vietnamese runtime UI, manifest localization and a Vietnamese README.
- Rework the board into native theme-aware Tasks, Accounts, Setup, Daily and Projects tabs; add keyboard navigation, persistent drafts and validated settings.
- Edit profile options, environment variables and secret names through native dialogs.
- Add an explicit primary manager and read-only supporting coordinators; preserve final authority across quota fallback and account switches.
- Add opt-in daily account selection/exclusion, quota and task budgets, durable owner decision logs, and bounded independent review/maintenance.
- Group tasks by source project, optionally create retained Git worktrees per new task, and prepare Codex desktop chats through its documented workspace deep link.
- Add daily/management/localization/project tests, bilingual browser QA and native VS Code language smoke checks.

## 0.3.1 — 2026-10-16

- Organize source into core, host, adapters, storage and UI; keep shared backlog contracts independent of rendering.
- Preserve the downloaded RelayCrew repository and its GitHub remote, and add repository metadata.
- Document the source layout and contribution boundaries.
- Retain 0.1.0, 0.2.0 and 0.3.0 packages with recovered source, version notes and SHA-256 checksums.
- Add archive verification and a version-checked GitHub prerelease workflow for future source tags.
- Preserve extension, command and configuration identifiers for existing installations.

## 0.3.0 — 2026-10-16

- Adopt RelayCrew branding, English README, MIT license and contribution/architecture documentation.
- Add multiple quota windows, a quota source service, running-account usage display, paused task account switches/pins and the system timezone default.
- Add Windows/Linux CI configuration and portable VSIX packaging.

## 0.2.0 — 2026-10-16

- Add three/four-stage flow setup, assignment board, public activity traces and owner questions/replies.
- Add immediate pause/resume, quota wait/resume, round-robin routing and useful backlog budgets.
- Add durable state recovery, source snapshots and two-way Telegram/Zalo adapters.

## 0.1.0 — 2026-10-16

- Initial AI Team Workbench: sidebar, status bar, role/account profiles and a CLI-based Dev/Audit/Repair/Lead pipeline.
- Add bounded repair tasks, audit reports, one-time/cron schedules, reminders, manual/file quota observations and cancellation.

Historical entries describe retained local builds. They do not claim a Marketplace publication, a GitHub release, or live provider/messaging validation.
