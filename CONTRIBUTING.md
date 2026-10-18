# Contributing to RelayCrew

Use Node.js 22 and npm. Install with `npm ci`, then run `npm run check`, `npm test`, and `npm run build`. Use F5 for the VS Code Extension Development Host. `npm run package` creates a local VSIX; it does not publish anything.

For an issue, include your OS, VS Code version, CLI versions, extension version, reproduction steps and expected behavior. Remove credentials, private source code and account identifiers from logs before sharing. Do not attach workspace storage, source backups, auth files, or token-bearing configuration.

Keep changes scoped and include meaningful tests for routing, state transitions, quota normalization, persistence and transports. Tests must use fake credentials/transports, not a contributor's real subscription or messaging account.

Architecture boundaries:

- `src/core/`: stable data contracts, pure validation/routing, backlog policy and job/step transitions. Keep this layer independent of VS Code, UI, storage and adapters.
- `src/adapters/cli/`: subprocesses, public streaming events, cancellation and redaction.
- `src/adapters/quota/`: read and normalize quota observations; never launch agents or select accounts.
- `src/adapters/messaging/`: authenticated inbound messages and durable outbound deliveries.
- `src/storage/`: atomic persistence and recoverable source snapshots.
- `src/ui/`: assignment board, flow setup and connection dialogs. Shared task types belong in `core`, rather than in a view.
- `src/host/`: compose VS Code configuration, commands, views, adapters and timers. `src/extension.ts` only exports activation/deactivation.

Tests import the layer they exercise directly. Keep build helpers in `scripts/`, static assets in `media/` and operational documentation in `docs/`. Generated `dist/`, dependencies and local VSIX packages are not source files.

Preserve `aiTeam.*` command/configuration IDs and the current extension identity unless a change includes an explicit migration. Version persisted state changes; older backups may lack newer optional fields. Never interpret unknown quota as available quota for automatic rotation.

GitHub Actions checks Linux and Windows. A workflow file being present does not mean those remote checks have run; read the actual workflow results on a pull request.

Keep existing `releases/vX.Y.Z/` artifacts immutable and run `npm run releases:verify` before committing. Follow [release instructions](releases/README.md) for future tags; never assign an old version tag to newer source.

## Changing the team flow

Read [user instructions](INSTRUCTIONS.md) first; keep the UI labels and guide consistent. The current engine supports delivery and plan/execute pipelines, sequential workers, extra auditors and configurable manager voting. Folder groups contain independent sequential jobs.

| Change | Start here |
|---|---|
| Worker policy, bounds, automatic model overrides | `src/core/delegation.ts` |
| Job transitions, handoffs and owner questions | `src/core/engine.ts` |
| Import validation | `src/core/configuration.ts`, `src/core/workflow.ts` |
| Direction proposals, validation and selected snapshots | `src/core/directions.ts`, `src/ui/direction-composer.ts` |
| Independent session trees and opt-in follow-ups | `src/core/session-branches.ts`, `src/ui/session-branches.ts` |
| Quota watch and maintenance stop gates | `src/ui/quota-watch.ts`, `src/ui/maintenance-controls.ts`, `src/core/daily-plan.ts` |
| No-call simulation | `src/core/simulation.ts` |
| Review seats, voting and owner resolution | `src/core/review-team.ts` |
| Folder groups and per-folder permissions | `src/core/task-folders.ts`, `src/host/console-controller.ts`, `src/ui/task-batches.ts` |
| Git change observation | `src/adapters/workspace-changes.ts` |
| Detached observer tabs | `src/host/live-session-panel.ts`, `src/host/agent-map-panel.ts`, `src/host/file-changes-panel.ts` |
| Team controls and draft synchronization | `src/ui/team-setup.ts`, `src/ui/map-team-editor.ts`, `src/ui/delegation-client.ts` |
| CLI calls, catalogs and persistence | `src/host/extension-host.ts`, `src/adapters/cli/` |

Model catalogs come from the connection, not a hard-coded latest-version list. Keep custom IDs optional and validate worker bounds before dispatch. Simulation must never call providers or produce real acceptance evidence. Persist new policy fields as optional for old jobs; snapshot them for new jobs. A Markdown guide supplies context, not extra permissions.

Use fake transports for automated tests. Real CLI demos require explicit task scope and must be labelled as real quota-consuming runs. Keep preview captures, local CLI copies and demo results out of commits. Do not move an existing release tag to preview code.

Native account metadata is allowlisted in `adapters/cli/account-data.ts`; Codex quota routing is composed in `adapters/quota/codex-source.ts`. Never copy auth files/keyring tokens or attribute one shared Google CLI login to several verified email accounts. CLI auth/usage reads must not start model turns. Theme polish belongs in `ui/release-styles.ts`; preserve keyboard focus, open sections and drafts during snapshots.
