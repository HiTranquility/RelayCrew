# Changelog

## 1.0.2-preview.5 — Unreleased

- Live execution journey and per-agent public activity show the recorded stage, workspace, mentioned files, latest progress and commands without attributing unobserved file edits.
- Double-click details refresh during execution while preserving tabs, scroll and expanded reports. Pause view freezes only the observer, then catches up on resume.
- Escaped Markdown code fences (including partial streams), language/file captions, line numbers, syntax accents, exact code copy, tables and expandable long reports; structured findings and decisions are separated from raw JSON.
- Refresh public child progress throughout native runs. Count unique children across both live/history sources, stop a run when reported children exceed its budget and apply the saved ceiling to displayed records.

- Per-session automatic, horizontal and vertical agent layouts with direction-aware arrows. Respect execution dependencies and actual parent ownership; preserve dragged positions and view preferences across live updates/reopening. Changing direction explicitly rearranges the selected session.
- Read native Codex child lifecycle metadata from the authorized exec thread when newer CLI versions persist subAgentActivity without streaming collaboration items. Poll only read-only thread/read; emit observed child IDs, names, models and public assignment/results. Never resume a thread or expose reasoning.
- Clear blocked-popup fallback links when switching sessions so a link cannot silently keep pointing to the preceding task.

## 1.0.2-preview.4 — Unreleased

- Put detach/hide controls directly on both browser observer panes, with a session-bound separate window and a fallback link when popups are blocked. Closing an observer preserves execution and other drafts.
- Show each session’s effective/original folder, worktree branch and saved execution policy. From VS Code, reveal the assigned folder or open multi-folder preparation for a new task without retargeting the current job.
- The browser exposes folder scope and session navigation as observation only; filesystem selection and permissions remain in VS Code. Stale detached observer IDs return an error instead of silently following a different task.
- Keep the More menu within narrow screens and surface native window-move errors.

## 1.0.2-preview.3 — Unreleased

- Apply a shared control/card/dialog radius scale, clearer semantic states, larger map controls and visible keyboard focus while respecting the VS Code theme.
- Keep large maps readable at 90% around the selected agent; explicit Fit remains available for an overview.
- One owner composer in the embedded browser view; standalone Live keeps its own form without a sticky overlay. Secondary view/report actions move to More.
- Browser dark/light/system palettes synchronize across map and Live panes; simulation labels use neutral color and owner questions retain the attention accent.
- Read live local CLI recordings as an observer, retain the last complete snapshot during writes and hide unsupported real-run controls. No provider calls are launched by the observer.
- Keep later manager rechecks after earlier reports in dependency order.

## 1.0.2-preview.2 — Unreleased

- Interactive, token-free browser walkthrough: 2–6 sequential Executors, bounded illustrative children, parent/child handoffs and a blocking owner question. Pause, step, stop, configure and reply from either input.
- Layout the actual Executor ownership tree without overlapping nested children; preserve child identity in exchanges and isolate activity to its agent/step.
- Responsive demo panes with a draggable/keyboard divider, separate views, working report/copy controls and explicit simulation versus finished CLI recording labels. VS Code-only actions are hidden or adapted in the browser.
- Reject simulation jobs at the execution-engine boundary so a queued walkthrough cannot start providers.

## 1.0.2-preview.1 — Unreleased

- Visible primary-manager promotion and supporting-manager votes in Setup and the map editor; keep provider defaults distinct from role assignments.
- Open several independent Live tabs, each with its own owner-reply draft and stale-question checks.
- Bundled English/Vietnamese conventions-auditor guides and an editable starting template, with independent repair rechecks before manager approval.
- Configurable code/review budget: default three rounds, range one to ten, saved per new task and Daily job and inherited by approved follow-up branches. Remaining findings stop for attention; requeue or account rotation cannot reset the limit.
- A round can include several bounded workers. The limit applies to workbench iterations and repeated code-step attempts, not individual native CLI tool calls.

## 1.0.1 — 2026-10-18

- Guided preparation before Live: connect accounts, assign roles, edit prompts/Markdown, review the saved team, then send.
- Compact account list with adjacent login/test/usage controls; advanced roles, installation, secrets and manual quota expand on demand.
- Theme-aware running/completed/attention/error accents, readable badge/warning text, responsive account rows and consistent detached Live/map surfaces.
- Read native Codex identity/plan and quota/reset windows without a model turn; reject declared-email mismatches before routing. Claude reports verified identity/plan; Antigravity reports shared-login model-group quota without claiming verified Google emails or independent quotas.
- Bulk account profiles, explicit preferred/fallback controls and bounded recovery using independent credential stores; preserve completed work, model policy and permissions.
- Expand maps and all observation views; zoom to 300%, pan by keyboard, inspect agent details with double-click/Enter, retain view state during live updates, and group reported native Codex children under their actual parent.
- Separate conversation, child-agent, file-change and technical sections in Live; movable/detached observers and preserved drafts/focus.
- Validation: strict type checking, 175 automated tests, bilingual light/dark and narrow UI, preparation/live, account/recovery and expanded-canvas interaction checks. Account badge/warning text measured at least 4.5:1 in tested light/dark palettes. Real read-only account metadata/usage checks ran locally; no auth tokens or private preview artifacts are shipped.
- Limits: Google CLI profiles still share one native login, Claude native quota is not collected headlessly, and child visibility depends on public CLI events. Worker dispatch remains sequential.

## 1.0.0 — 2026-10-17

- AI proposes editable directions A/B/C with scope, implementation plan, file structure and acceptance; selection is snapshotted before execution.
- Persistent usage/limit bar and task-specific account switching, including independent auditors and manager votes. Unknown quota remains unknown.
- Named review seats, configurable unanimous/majority/chair decisions, bounded planner workers and optional current model catalogs.
- Multiple-folder task groups, independent task/chat branches with bounded public context and opt-in follow-up sessions after parent approval.
- Draggable/detached live sessions, agent maps and Git-observed file changes; canvas/list/table/dependency views, public handoffs and completion controls.
- Useful maintenance catalog, Markdown stop gates, per-account/model budgets and fresh-quota gating; no dummy token spending.
- English/Vietnamese instructions, reusable stop-gates guides, keyboard controls, preserved drafts and source/release archives.
- Validation: 160 automated tests, strict type checking, bilingual light/dark/narrow UI and native VS Code host; local fake transports for release checks.
- Provider-native recursive agents, exact quota APIs for every provider, simultaneous execution and automatic cross-repo merges are not provided.

## 0.9.9 — 2026-10-17

Operational polish and privacy fixes

- Account checks and visible per-account secret management; missing references are reported without showing values.
- Include/exclude filters and persistent pagination for Tasks, Accounts, Daily work/accounts, Projects and Backlog.
- Inline useful backlog, bounded budgets, removal of pending items and retry receipts. Live snapshots/acknowledgements preserve edited drafts and field focus.
- Stop acts on the selected task ID; reply/resume/report/schedule commands open relevant inline controls without task-selection popups.
- CLI live output redacts secrets even across stream chunks. Persisted webview state is allowlisted and credential fields are stripped; JSON replacements use restrictive file modes.
- Telegram/Zalo edits can retain stored credentials by leaving fields blank. Same-identity transport edits preserve conversation context; disconnect deletes credentials. Tests send real messages only when explicitly requested.
- Guide: docs/WORKBENCH-09.md. Voice uses system dictation when the webview lacks speech support; physical microphone and live external messaging credentials were not tested. Antigravity capability restrictions remain documented.
- Validation: 125 tests, strict type checking, bilingual light/dark and narrow UI, drag/resize/persistence, speech event/fallback, filters/pagination/secret-draft guards. Actual isolated VS Code host passed both languages, one local HTTP chat, popup checks and cancellation without a second inference.



## 0.9.8 — 2026-10-17

Split Console, document formats and dictation

- Place the prompt below or beside the execution monitor; resize it and retain layout. Narrow layouts stack automatically.
- Display the running agent, phase, public tool activity and measured elapsed time; never fabricate an ETA. Submitting and running are distinct states.
- Add WebP/GIF and bounded DOCX/ODT text extraction. PDF snapshots go to CLI document tools; unsupported tools must ask for text. HTTP profiles reject PDF instead of silently misrepresenting it as an image. No OCR or original document layout is promised.
- Voice input supports available browser speech after opt-in, plus explicit system-dictation guidance in VS Code (Windows Win+H). Unsupported webviews say so. Dictation only changes the draft, never auto-sends; RelayCrew stores no audio.
- Checked document boundaries/entities, binary signatures, split-pane interaction, dictation/fallback events and bilingual UI regressions.



## 0.9.7 — 2026-10-17

Measured daily work and model budgets

- Save daily plans without starting; persistent saved time and explicit start action.
- Daily tasks show live agent, phase progress, result/blocker, flow and owner checklist. New items accept a Definition of Done.
- Set per-account/model-policy quota ceilings and agent-run budgets. Every role/retry consumes an agent run; existing account and plan ceilings also apply. Automatic models need no exact ID.
- Record before/after quota source and timestamp around daily agent runs. No invented token totals or deltas across unchanged/reset/source-switched observations. Limits stop later dispatch, not an in-flight request.
- 0.9.6 remains reserved for remote-repository authentication.
- Verified budget gates, retry accounting, checklist snapshots, observations and bilingual UI regressions.



## 0.9.5 — 2026-10-17

Daily work across local folders

- Import several local folders at once; select included folders and per-folder Read only, Auto or Full permission.
- Full permission requires a modal showing the selected paths. Global Allow Edits, per-plan editing, task read-only roles and backups still apply. Full CLI mode can operate beyond folder boundaries.
- Snapshot folder/permission on each daily task; downgrades stop dispatch without granting existing tasks more access.
- Explicit tasks select a folder; generated independent maintenance covers each included folder within existing time/run budgets.
- Remote GitHub/GitLab login remains reserved for 0.9.6, not included here.
- Checked permission routing, multi-folder dispatch, existing tests and bilingual UI regressions.



## 0.9.4 — 2026-10-17

Provider onboarding and portable layout

- Export/import only validated layout geometry and preferences; no prompts, accounts or secrets.
- Install detects an existing CLI first and asks for confirmation with the exact command before starting an installer.
- Prevent duplicate onboarding requests; show sign-in/connection progress in account cards.
- Separate Antigravity agy provider, stream protocol and native model selection. Existing Gemini accounts remain intact. Read-only runs fail closed without documented deny rules; images are not supported by this adapter yet. See docs/ANTIGRAVITY.md. An authenticated agy run was not available locally.
- Type checking, protocol/security tests and bilingual light/dark UI checks.



## 0.9.3 — 2026-10-17

Visual hierarchy and contrast

- Theme-aware contrast, stronger focus rings and text/status symbols that do not rely on color.
- Clearer primary manager, form labels, action bars, table spacing and selected tabs.
- Text scaling now covers existing headings and metadata; narrow layouts and reduced motion remain supported.
- Verified English/Vietnamese light/dark UI and layout interaction regression checks.



## 0.9.2 — 2026-10-17

Interaction and layout fixes

- Drag or keyboard-resize Console panes; save workspace layout, text scale and density.
- Discover keyboard shortcuts, close inline editors with Escape and retain drafts.
- Keep active form focus during live snapshots; prevent duplicate Ctrl+Enter submits and preserve edited acceptance drafts.
- Verified: 114 tests, type checking, English/Vietnamese light/dark UI and drag/resize/reload/narrow layout browser checks.



Versions before 1.0 are early releases. See [release archives](releases/README.md) for exact packages, hashes and source provenance.

## 0.9.1 — 2026-10-17

- Remove generated previews from the tracked repository and README; retain local ignored QA files.

- Bundle five editable role guides, four workflow guides, a task brief and a Definition of Done example, with bilingual usage instructions and no account/model pins.
- Add a Markdown examples button and Command Palette action to reveal the bundled folder; use the existing role/workflow importers after copying and editing.
- Validate every shipped guide through the existing role-template/workflow snapshot contracts. Existing task snapshots and all 0.9.0 archives are retained unchanged.

## 0.9.0 — 2026-10-17

- Remove obsolete rendering helpers/imports and enforce TypeScript noUnusedLocals.

- Surface readable public agent conversations, handoffs, audit findings and manager decisions in Live Session.
- Add multi-task mission cards with per-task flows, agent assignments, saved context, owner acceptance checklists and honest recorded-phase progress.
- Turn Overview into an actionable decision/queue/quota/schedule inbox.
- Add inline schedule planning with Timeline, Board and Table, timezone recurrence, estimated windows and fresh per-occurrence acceptance snapshots.
- Add inline daily plan/task editing, priority controls, dispatch preview and per-account eligibility explanations.
- Add Local/Cloud compatible HTTP profiles, Ollama/LM Studio presets, catalog discovery, optional model pins, SecretStorage API keys, explicit-context attachments and read-only streaming. Keep CLI as the default and required for repository editing/tools.
- Preserve transport/location boundaries during automatic fallback and record each dispatched connection. Reject redirects, unsafe endpoint URLs, editable API turns and truncated/unsupported responses.
- Retry transient Windows state-file locks while preserving atomic replacement and the previous state.
- Extend real local-HTTP, planner, persistence, bilingual browser and native VS Code host validation; retain all previous archives.

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
