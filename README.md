# RelayCrew

**English** · [Tiếng Việt](README.vi.md)

**Your AI coding team, visible in VS Code.**

Give the team a task, choose who develops, plans, reviews and manages, then follow the work as it happens. RelayCrew connects your own Codex, Claude, Antigravity/Gemini or local accounts. One account can handle several roles.

- **See the work:** live public messages, assignments, handoffs and results; inspect agents on a canvas, list, table or dependency view.
- **Shape the team:** editable presets, role names, prompts and Markdown instructions. Model IDs are optional.
- **Stay in control:** pause, answer agent questions, switch accounts and set usage limits. Track tasks and your Definition of Done separately.
- **Plan ahead:** schedules, useful daily backlog work, project folders and optional messaging connections.

## Try it

1. Install the VSIX from [Releases](https://github.com/HiTranquility/RelayCrew/releases), then open a trusted project in VS Code.
2. Open **RelayCrew → Prepare a run**. Connect accounts, assign roles, add optional Markdown instructions, and review the saved plan.
3. In **Accounts & quota**, use the buttons beside each account to sign in, test the connection and inspect native usage/reset windows where available.
4. Send a small task with clear completion criteria. Click an agent to inspect its work; use **Pause** whenever needed.

RelayCrew **1.0.1** adds clearer theme-aware states, a compact account list, guided preparation, larger interactive maps and separate Live sections. It includes AI-suggested directions you can edit and choose, a persistent quota bar, bounded independent session branches, movable live/map/file panels, and Markdown stop gates for useful daily work. **Simulate flow** makes no model calls; real proposals and demos consume provider quota.

## Make it yours

Start with [user instructions](INSTRUCTIONS.md): team flow, models, worker limits, Markdown guides and the supervised demo. Copy a [Markdown starter](examples/README.md) into your project and edit it.

For more detail: [Console and panels](docs/CONSOLE.md) · [Tasks and schedules](docs/OPERATIONS.md) · [Models and prompts](docs/MODELS-AND-TEMPLATES.md) · [Contributing](CONTRIBUTING.md).

RelayCrew is an early, local-first extension. Accounts, available models and quota information depend on your provider. Worker assignments run sequentially, one level deep; Codex native children appear only when its CLI reports public collaboration events. Codex can report its signed-in identity and quota; Claude reports identity/plan; Antigravity reports shared-login quota without verifying the Google email. Only public agent output is shown. Messaging needs your own connection setup; this is not a hosted team service.

[MIT License](LICENSE)

[Current behavior, account support and recovery](docs/CURRENT-BEHAVIOR.md). Prepare → review the plan → confirm → observe → verify acceptance.
