# Using RelayCrew

[Tiếng Việt](INSTRUCTIONS.vi.md) · [Overview](README.md)

Instructions for RelayCrew 1.0.1. Older packages may not contain every control below.

## prepare before Live

Open **Prepare a run** and follow four steps: **Accounts & models → Roles & delegation → Prompts & Markdown → Review & open live**. Save changes in each editor. The review shows saved assignments and warns about unsaved drafts. Markdown is optional: use built-in prompts, attach a role guide, or import a team workflow. Opening the composer never starts a task; press Send when ready.

In Live, **Conversation**, **Agents & flow**, **Changed files** and **Technical activity** have independent visibility buttons. **×** hides one section; **Show all** restores it. **Minimize content** keeps the session header visible. Preferences survive incoming output and reopening the workspace. **Open live session tab** gives the session its own VS Code tab; drag it to another group/window or use **Move to new window**. **Close view** closes only that tab. Stop the task with **Stop task**.

See [real subagent demo and map shortcuts](docs/NATIVE-AGENT-DEMO.md). Some CLI versions omit child identifiers; the observer explicitly reports this limitation and keeps the dispatcher report available in Conversation.

## 1. Connect your accounts

Open **Accounts & quota**, add or edit a profile, then use **Install CLI**, **Sign in** and **Check connection** as needed. Installation checks the machine first and asks before installing. Complete provider login yourself in the terminal/browser. A successful connection does not guarantee access to every model.

Keep credentials in the extension's secret controls, not in a prompt, Markdown file or committed settings. Cloud/local describes where a model runs; CLI/HTTP describes the connection. HTTP review needs supplied context and has no repository tools.

### Multiple accounts and recovery

In **Accounts & quota → Add multiple accounts**, enter one email per line. The first becomes preferred for new provider presets. Codex and Claude profiles receive separate login folders: sign in to each one. An email label is not a verified login. Antigravity Google profiles currently share the native CLI login; use the manual account login controls. See [Antigravity account limitations](docs/ANTIGRAVITY.md#multiple-google-accounts).

**Fallback & recovery plan** shows the current account, backup eligibility and why an account cannot take over. You can exclude an account from fallback in its profile, restrict role pools, enable independent backup switching, or wait for a fresh quota observation. Retrying a provider-limited step requires its separate toggle because files may already have changed. Recovery preserves completed stages and retries the unfinished step in the existing session, with the same model/effort and permissions. It neither creates parallel work nor replays completed steps. Retry history appears in Live; three provider-limit attempts per step remain the ceiling. Manager/reviewer/daily seats need an explicit account switch.

## 2. Choose the work and the team

Use **Chat** for conversation with one account. Use **Team task** for work that needs a pipeline. Include the project, scope, permitted actions and Definition of Done.

Open **Live console → Agent map → Edit team**. Start from a preset, then click a role card to change its account. One account can fill several roles. Rename accounts independently of role names; **Preferred account** chooses that account for new provider presets without changing existing assignments.

| Workflow | What happens |
|---|---|
| Delivery | Dev implements → Audit reviews → optional Repair assignments → Manager decides |
| Plan and execute | Dispatcher briefs → Planner splits the work → Executors complete bounded assignments → Manager reviews evidence |

The **Codex → Claude → Antigravity** preset chooses Codex for dispatch and final management, Claude for planning and Antigravity for execution. All three profiles must already exist. These are editable starting assignments, not required providers.

Click **Rename / instructions** to edit a role's name, input/output prompts or attach its `.md` guide, then save templates. Use **Save team flow** for future tasks. Existing tasks retain their configuration snapshots. Changing a card does not rewrite work already recorded.

In **Auditors and manager decisions**, add up to four extra auditors and name seats such as Audit 2 or Manager 2. Extra auditors share the worker ceiling. **Add manager** adds another manager account; select **Decision maker** for each manager whose vote should count. Unselected supporting managers provide advice. The chair remains Manager 1.

Choose **All must agree**, **Majority** (ties ask you), or **Chair decides after review**. **Ask before running** pauses before the first model call. You can remember that policy for future tasks using the same team. A blocked vote pauses for your resolution and preserves every vote; it does not start an endless debate.

For several projects, expand **Multiple folders · team task** in the composer. Use **Choose more folders**, check 1–20 folders and choose read-only or team edit permissions for each. One submission creates a group of separate folder workflows, processed sequentially. The group shows finished-folder progress and links to each session. Cross-folder dependencies are reported for owner coordination; this is not one atomic change spanning all repos. **Stop task group** stops active and queued members while preserving edits.

## 3. Choose models without memorizing IDs

| Choice | Meaning |
|---|---|
| Profile default | Inherit the account's model policy |
| Automatic recommended | Resolve the provider's current default/recommended model or alias when a step starts |
| CLI default | Let the CLI select its own default |
| Custom model / alias | Paste an optional supported ID or alias to pin this role |

**Refresh models** loads a catalog where supported (Codex and compatible HTTP endpoints). While the editor is open, stale catalogs are checked periodically. Other CLIs retain native selection. This does not upgrade a CLI, guarantee account entitlement or change an already running step. Switching back to automatic clears the role's pin. Reasoning effort is separate and depends on the provider.

## 4. Bound delegation

Under **Workflow and worker limits**, choose:

- **Planner decides within bounds:** specify a minimum and maximum number of worker assignments.
- **Fixed worker count:** specify one exact count; minimum follows that value.

Workers run **sequentially, one level deep**. This is the number of workbench assignments, not simultaneous accounts or provider-native recursive agents. Supporting coordinators are separate. The global child-task ceiling still applies; out-of-bounds plans stop before workers run. If a useful plan cannot fit, the planner should ask you rather than invent work.

Example: adaptive **1–2** means the planner may assign one or two useful checks. A successful attempt uses three core calls (dispatch/dev, plan/audit, manager), plus workers, extra auditors and other manager seats. Each selected folder has its own calls. Retries and owner replies can add calls, subject to existing limits. Set account quota ceilings separately; token readings may be unavailable or approximate.

## 5. Simulate, then observe a real demo

In **Edit team → Simulate or run a read-only demo**, write a small task:

> Inspect the project entry points. Plan 1–2 read-only checks and report file evidence. Do not edit files, run tests or publish.

**Simulate flow** creates a clearly labelled illustrative session. It does not call models, inspect code, spend tokens or verify acceptance.

**Run read-only demo** queues real calls using the draft team without saving it as your default team. It uses the first workspace folder and normal provider/quota limits. Verify that the intended model is available on each account before running. The demo is read-only for all roles.

Use **Observe task** to inspect the live session. Canvas, List, Table and Dependencies show the same recorded work. Click a node or handoff to see public prompts, replies and CLI events. RelayCrew forwards reports between steps; arrows do not imply the CLIs directly connect to each other. No private reasoning is shown.

Drag the Live console panel headers to rearrange them. Open **Live session** or **Agent map** as separate VS Code tabs, then drag those tabs between editor groups or use **Move to new window**. These views observe the same task; closing them does not stop or duplicate execution. Disable **Follow output** to read older messages without jumping.

**Files changed** lists observed Git changes during CLI execution and opens as a separate panel. Unchanged edits that existed before the task are excluded. Concurrent user edits can still appear: this is observation, not proof an agent authored a file or that tests passed. Git-ignored files are excluded; a missing Git workspace is explicitly marked unavailable.

## 6. Pause, answer and resume

Use the visible pause controls to stop dispatch or pause the active process. When an agent needs an important product, architecture, security or deployment decision, it asks the owner and waits. Reply to resume that step. A manager approval is separate from your own Definition of Done checkboxes. Simulation produces no real approval.

Completion notifications are configurable in Settings. Panel close/minimize controls affect the view; use task controls to pause or cancel execution.

## 7. Reuse a Markdown workflow

Copy a guide from [examples](examples/README.md), edit it, then use **Setup → Workflow from Markdown → Preview → Apply**. A plain guide supplies context. A fenced `relaycrew` JSON block can also change assignments and limits; preview it before applying. Role guides belong in the role editor.

The [plan-and-execute example](examples/workflows/plan-execute.md) uses example profile IDs: replace them with your existing IDs first. Guides do not grant permissions, authorize publishing or allow extra agents. Keep your project-specific rules in your project; keep the required planner/manager response fields so RelayCrew can route work.

For schedules, daily backlog, messaging and backups, see [Operations](docs/OPERATIONS.md) and [Workbench](docs/WORKBENCH-09.md).

## 8. Choose a direction and watch capacity

The persistent **Usage & limits** bar shows the chosen account's observed usage and ceiling. **All accounts** shows sources, observation times, reset windows and provider limit reports. Refresh reads configured quota files/manual observations; it does not invent provider token counters. Choose a task and account, then **Switch account** to review the unfinished role before applying. Running work pauses first; completed history stays unchanged.

In **Team task → Directions A / B / C**, write a brief and choose the account for **Suggest directions with AI**. This makes one real read-only model call and consumes quota. Inspect the proposal session if it waits or fails. Edit scope, implementation plan, proposed file structure, acceptance and risks, then select one option. The selected label appears above your prompt. Sending the team task snapshots that option and adds its Definition of Done to your checklist. Suggestions do not authorize implementation automatically; replacement suggestions preserve your edited options until you choose to replace them.

## 9. Branch sessions and use daily quota

Open **Session branches → Branch task / chat** to create a separate session in an approved folder. Choose task/chat and permissions. It copies bounded public parent context and uses the current team/chat account. Parent owner questions remain paused. Manual branches are limited to three levels and eight children per session.

An AI direction can also propose up to three independent follow-ups. **Automatic follow-up sessions** is off by default. Set a ceiling, review/edit each follow-up and its folder, then send. They queue only after parent approval; children never auto-branch. With automatic follow-ups enabled, selected folders define branch scopes rather than a duplicate parent job per folder. Shared-folder edits remain sequential, without automatic merging between repos. Stop/cancel each session explicitly; stopping a parent does not roll back edits or cancel already-created independent children.

In **Daily quota tasklist → Useful quota work and Markdown stop gates**, choose maintenance categories or copy a template into your tasklist. Import/edit [the stop-gates guide](examples/maintenance/STOP-GATES.md). Each enabled account/folder/category runs once per day at most, within quota, agent-run and time limits. Unknown quota blocks dispatch. Architecture, product, security or publishing decisions wait for you; only unrelated useful work may continue. No finite backlog guarantees exhausting every token.

New keyboard controls: **Alt+Shift+D** opens directions, **Alt+Shift+Q** focuses account capacity, **Alt+Shift+B** branches the selected session. **Ctrl+Enter** inside a direction chooses it; inside the branch editor it queues that branch. **Escape** closes those controls while preserving drafts. The ordinary composer retains its configurable Enter/Shift+Enter behavior. VS Code keybindings remain customizable.


## account identity and native limits

In **Accounts & quota**, the account list puts **Sign in**, **Check connection**, and **Usage & rate limits** beside each profile. The first board opening checks installed native CLIs in the background; Check connection retries on demand. Checking reads account metadata without sending a model prompt. Role assignments, secrets and manual quota are under Roles & advanced account settings. Codex exposes the signed-in email/plan and quota windows through its app-server; these live windows also refresh the quota bar. Claude exposes the signed-in email/plan through `auth status`; native limits remain available in Claude Code `/usage`. Antigravity exposes model-group quota through `/usage`, but not the signed-in email: Google profiles share that reading, not independent quotas. Declared email mismatches cannot borrow another Codex account's quota. Percentages are not exact token balances; unknown stays unknown. Manual/file quota observations remain separately labeled.


## Preview after 1.0.1: chair, independent Live tabs and bounded conventions review

The team setup has a visible **Primary decision maker** selector and **Make primary** on supporting manager seats. Promoting a seated manager swaps chair/support seats while preserving the chosen voting policy, voters and names. Choosing an account outside the manager team replaces its chair seat. Save the team for new tasks; existing sessions retain their recorded assignments. A provider’s preferred account is separate: it supplies new presets and never changes an actual login or a saved task.

**Separate Live sessions** in Console opens individual tasks as Live tabs or windows; select up to four at once. Drag VS Code tabs beside one another. Each view remains bound to its own task, including stop, question replies and file/map controls. Answer owner questions directly in each tab with Ctrl+Enter. Drafts and retry receipts stay local to that view; a changed question requires explicit confirmation before reusing an old answer. Several observers do not enable simultaneous agent writes: execution remains sequential per workspace.

In **Prompts & Markdown → Audit → Starting template**, choose **Conventions auditor**, inspect the guide, then **Save all templates**. The English/Vietnamese guides in `examples/roles/` require changed-hunk coverage, the target repository’s canonical rules, file/line evidence, acceptance results and honest NOT RUN/BLOCKED limits. Tests passing never replaces reading code; preferences are not invented conventions.

**Setup → Advanced settings → Maximum code/review rounds** defaults to 3, range 1–10. New coding jobs snapshot it; Daily jobs do too. A repair batch is followed by an independent audit. With a planning workflow, planning precedes round 1 and a code audit follows execution. A round may contain multiple bounded worker tasks. Unresolved repairs at the final round, or repeated coding attempts at the saved cap, stop as Needs attention. Requeue, reload and account switching cannot reset that stop. The report retains every finding/attempt; authorize a new bounded task if needed. This bounds RelayCrew rounds and code-step attempts, not internal provider tool calls. Read-only reviews/demos and legacy jobs keep their original execution semantics.

## Interactive branch walkthrough

From a source checkout, run `npm run demo` and open the printed localhost URL. This Vietnamese walkthrough uses no accounts, models or quota. Choose 2–6 Executors and 1–2 illustrative children each, at most 12 children. Workers are sequential; children illustrate parallel branches. The first Executor asks for scope and waits for your reply. Pause, Step, Stop, pane resizing, map views and report download work in the browser. This does not prove native CLI children ran or code was validated. Real child observation still depends on public provider events in a separately authorized real task. Optional `--recording path.json` loads only a finished local recording for viewing; keep recordings private.

The browser walkthrough has **More → Theme** (dark, light or system), synchronized across its panes. Its embedded layout uses one owner composer above the panes; a standalone Live window keeps its own input. Large maps focus on readable cards; use Fit for the whole graph. **Detach Live** and **Detach Map** sit directly above their panes. They open the selected session in a separate browser window (or tab, depending on the browser). If popups are blocked, use the fallback link. Hide a pane with × and restore it with Both panes / Map / Live. **More** contains theme and report download. The **Folders** button shows the effective folder, original folder/worktree and saved permission policy; the browser is observation only. To follow an independently running read-only CLI job, pass `--live-recording path.json`: this is an observer and cannot stop or answer the runner. The source file is never executed or modified by that observer.

In VS Code, expand **Folders & permissions** in any Live session. **Show folder in Explorer** reveals that task’s effective folder. **New task / folders** opens the team composer with the multi-folder section expanded; use **Choose more folders**, check folders and choose permissions before sending. This prepares a new task and preserves the current session’s scope and any composer draft.
