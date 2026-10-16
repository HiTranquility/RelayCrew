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
