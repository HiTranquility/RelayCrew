# Changelog

Versions before 1.0 are early releases. See [release archives](releases/README.md) for exact packages, hashes and source provenance.

## 0.8.0 — 2026-10-17

- Add one-account read-only chat and greeting routing; keep coding pipelines explicit. Show readable replies with expandable technical activity.
- Send with Enter/Shift+Enter, configurable Ctrl+Enter preference, composition/pending guards, configuration form shortcuts and global board/chat/task/pause shortcuts.
- Deduplicate Claude text deltas and final assistant snapshots.
- Show Install CLI, Sign in and Check connection on account cards; discover executables before dispatch and return actionable missing-CLI errors.
- Move role controls into a separate card corner: accounts can cover multiple roles; the primary-manager selection is exclusive.
- Open prompt editing from role pencils, flow nodes and composer. Rename roles and attach/edit per-role Markdown with immutable task snapshots.

## 0.7.0 — 2026-10-16

- Add editable input/response templates by role, built-in presets, local preview/reset, Markdown import and per-task snapshots/hashes.
- Make model IDs optional: current Codex catalog recommendation or Claude/Gemini flagship aliases, retained custom pins, reasoning levels and per-account quota ceilings.
- Refresh the VS Code themed workbench with compact navigation, account cards, responsive forms and section links.
- Highlight the primary manager card, selected account role button, overview card and final flow node; label final approval separately from supporting coordinators.
- Replace common account/team/routing/quota/switch/messaging popup wizards with inline board forms, validation, Save actions and local feedback. Native file selection and interactive CLI authentication remain available.
- Paste, edit and preview Markdown workflow guides in Setup before applying. Preserve configuration drafts through reloads and live snapshots; refresh newly added account choices without discarding edits.
- Store profile secrets outside draft state, clear password fields after submission/closing, and retain connection test/disconnect controls.
- Add configuration validation and browser/native checks; preserve all previous release assets.

## 0.6.0 — 2026-10-16

- Add inline account forms, CLI discovery, role assignment buttons, scoped CLI login terminals and real read-only Dev → Audit → Lead connection trials.
- Import UTF-8 Markdown workflow guides with optional validated role/model/manager configuration; preview before applying and retain a guide snapshot per task.
- Attach PNG/JPEG or UTF-8 text/code via picker, drop or clipboard image paste; persist bounded, hashed local snapshots for tasks and owner replies.
- Add copy-answer/report actions, session/composer visibility controls and native VS Code sidebar/panel/close-board commands.
- Preserve earlier release archives. See QUICKSTART and CONSOLE documentation for authentication, file limits, retained cache and provider image-tool behavior.

## 0.5.0 — 2026-10-16

- Make Live console the default: inline multiline composer, session list, actual runtime identity, public event output, elapsed time and inline owner replies.
- Support `/new`, `/reply`, `/pause`, `/resume`, `/stop`, `/status` through the existing engine. Persist request IDs for deduplication and guard replies against changed questions.
- Patch stream/snapshot updates without replacing the composer; retain drafts, selected session, follow preference and filters. Scrolling up pauses follow output.
- Add Overview role/account cards, observed quota meters, current work, recent handoffs and first-run guidance.
- Add task search, status filters, recorded-step rails and expandable assignment details; retain English/Vietnamese and VS Code theme support.
- Add console controller/engine/render tests and browser checks for submission, errors, snapshot updates and drafts.

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
