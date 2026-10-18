# Validation · 16/10/2026

For current supported behavior and limits, read [RelayCrew 1.1](CURRENT-BEHAVIOR.md). Version-labelled sections below describe historical changes and are not a complete current support matrix.

## 0.9.1 — 2026-10-17

113 automated tests and strict TypeScript/noUnusedLocals checks pass. Each shipped workflow imports without changing arbitrary existing account/model configuration; all five role Markdown guides survive validated snapshots. Native isolated VS Code host passes version 0.9.1, command registration and one local HTTP chat. Browser QA passes both languages/themes including the Markdown examples action.

Generated screenshots/HTML live only in the ignored local `docs/previews/` folder. They are not included in the current repository tree, VSIX or new source snapshot. Generate locally with `npm run preview`; optional browser checks use `npm run test:ui`. Historical release archives remain immutable.

## 0.9.0 — 2026-10-17

- Strict TypeScript check and 112 automated tests pass locally on Windows. New tests use real loopback HTTP servers for catalog discovery, optional/ambiguous model selection, streaming UTF-8/SSE, split-secret masking, HTTP 429, cancellation, interrupted streams, redirect rejection, unsupported tools and actual engine completion/wait states.
- Planner tests cover explicit timezone offsets, cron recurrence, estimated windows, disabled schedules, phase counts before dynamic repair creation, acceptance persistence/deduplication and selected older sessions beyond the recent-session window. Daily tests keep generated repository maintenance on CLI accounts and API work read-only with supplied context.
- Browser QA passes English/Vietnamese, light/dark: schedule Timeline/Board/Table and draft recovery, inline daily settings/items, task acceptance/conversation, Local API forms/presets, existing account/role/template controls, attachments and responsive Console/Setup/Tasks/Schedules/Daily layouts. Preview images are demonstration data.
- The actual isolated VS Code Extension Development Host passes activation, all contributed commands, common configuration without input popups, EN/VI board localization, API catalog check and one successful read-only local HTTP chat. It uses a temporary fixture server and isolated VS Code user/extensions directories, not an installed Ollama/LM Studio model or paid cloud request.
- A transient Windows destination-file lock observed during native testing is handled with bounded retry of the same atomic rename. Tests verify that the old state is preserved while locked and that permanent disk errors preserve both primary and pending data. Native HTTP smoke passed again after the repair.
- Previous live CLI evidence is recorded in the 0.8/0.6 entries below. No additional paid Codex/Claude/Gemini call, real local-model inference, interactive login or Telegram/Zalo delivery was performed for this release.


## 0.8.0

99 automated tests cover the prior suite plus chat parsing/lifecycle/context, preflight failures before job creation, readable replies, Claude streaming deduplication, fixed install/login plans, shell argument quoting, honest authentication status, and role name/Markdown validation and isolation.

Browser QA exercises Enter sending, Shift+Enter/newline, IME and pending guards, Ctrl+Enter preference retention, configuration Ctrl+Enter saving, multi-role account checkboxes, exclusive manager selection, visible onboarding actions, prompt-pencil navigation and role guide import/save. English/Vietnamese and light/dark themes are covered; previews use demo data. Native VS Code smoke checks contributed commands and common configuration without popup wizards.

An authorized live Codex chat test sent `hello` through the real extension in an isolated VS Code profile. It completed with exactly one read-only call, current catalog model `gpt-6.1-sol`, medium effort, four public events and response `Hello! How can I help you today?`. No tool event or Audit/Manager stage occurred. The CLI sign-in check passed without exposing account identity. This verifies the bounded greeting path, not general coding quality. Install commands and interactive sign-in are wired and fixture-checked; no global CLI installation, login session change or real Claude/Gemini generation was performed during these tests.

## 0.7.0

Added tests cover one-pass template substitution, immutable snapshots, actual engine role requests with required output contracts, Markdown templates, model catalog/alias/custom/fallback selection and account quota ceilings. A metadata-only check of the installed Codex model/list returned the current recommendation without creating a thread or model turn. Browser QA includes template presets/edit/preview/reset/reload and optional model controls.

92 automated tests pass, including flow/model/manager validation, rotation pools, manual quota bounds and credential exclusion from rendered configuration. Strict TypeScript and production build checks pass. English/Vietnamese browser QA passes in light/dark themes: inline team/routing/Markdown/quota/account switching, errors retaining drafts, added account choices during live snapshots, secret inputs excluded from saved state, and narrow layouts. Primary-manager account and final-node highlighting is asserted and preview screenshots are inspected.

Native VS Code smoke checks activation, contributed commands, English/Vietnamese titles, one shared board and zero QuickPick/input dialogs for common account, flow, routing, quota, switching, messaging, secret and language configuration commands. File selection and interactive CLI authentication deliberately remain native. Scheduling and daily-plan legacy dialogs are outside this change. These UI checks make no new provider calls or live messaging deliveries; the authorized Codex trial evidence below remains from 0.6.0.

## 0.6.0

78 automated tests pass, including immutable attachment storage/tamper detection, limits and transport, controller task/reply deduplication, Markdown configuration validation, guide snapshots, account form validation and executable discovery. Browser QA passes English/Vietnamese in light/dark themes, including inline account saving/draft recovery, CLI detection messages, assignment actions, picker cancellation, file drop, attachment reload/retry/clear, copy actions, layout toggles and narrow Console/Setup layouts. Native smoke passes activation and all contributed commands.

An explicitly authorized live integration test ran the real extension in an isolated VS Code profile against an already authenticated Codex CLI, medium effort and its default model. All three read-only stages completed (Dev → Audit → Lead); the lead returned `approved`, and 15 public events were recorded. Dev read the root package name/version; Audit verified that answer; Lead summarized the preceding evidence. This proves local Codex transport and the bounded trial lifecycle, not broad code-review quality or image understanding. Actual model identity was not supplied in the profile, so the UI correctly labels it CLI default. User/account identifiers and authentication data are excluded from committed evidence.

Live Claude/Gemini model calls, provider image consumption, interactive login and Telegram/Zalo delivery were not exercised. Claude/Gemini image support follows documented image-read tools; the fixture tests verify payload/path wiring, not a model's successful image inspection. Live tests are opt-in through `scripts/live-trial.mjs`, never part of CI or the default unit suite.

## 0.5.0

69 automated tests cover the existing suite plus console parsing, root validation, persistent task/reply deduplication, changed-question rejection, actual engine progression, HTML escaping and observed quota presentation. Native smoke also opens New Task without a blocking input dialog. Browser QA checks multiline Ctrl+Enter submission, inline errors, drafts through snapshot/reload, session replies, filters/search and narrow console layout in both languages/themes. All preview sessions are demo data; no paid provider or live messaging accounts were used.

- TypeScript strict check: passed.
- 38 unit/integration tests: passed locally on Windows.
- Native VS Code Extension Development Host: activated; all contributed commands registered; Assignment Board và Setup Flow mở thành webview tabs.
- UI preview HTML rendered with a Chromium-based headless browser; flow và board images inspected. Preview dùng dữ liệu demo, không phải account/model/session đang hoạt động.
- npm audit, cả development dependencies: 0 vulnerabilities tại thời điểm kiểm tra.

Tests bao phủ phân vai, flow 3/4 bước, owner question/reply, không replay bước đã hoàn thành, pause ngay, shutdown, quota wait, round robin, backlog budgets, streaming output, lọc public text khỏi thinking, CLI timeout/cancel tree, shell quoting, token redaction, sender allowlist, webhook raw-body signature, chống nhận trùng, outbox uncertainty, state recovery và source snapshot.

API/CLI integration dùng fake transport/CLI hoặc local signed HTTP webhook. Chưa gửi tin bằng bot/OA thật, chưa chạy task bằng provider account thật, chưa xác minh model ID của người dùng, chưa kiểm tra OAuth refresh hoặc public HTTPS forwarding Zalo. Cần credential và cấu hình môi trường của owner để kiểm thử live.

Preview:

- `previews/flow.html`, `previews/flow.png`.
- `previews/board.html`, `previews/board.png`.

Chạy lại bằng `npm run check`, `npm test`, `npm run build`. Native smoke: `node scripts/smoke.mjs /absolute/path/to/your/code-executable`. Tạo HTML demo: `npm run preview`.

0.3 bổ sung tests cho nhiều quota windows, file source có giới hạn đọc, account thực trong status bar, pin account cho task và múi giờ hệ thống. GitHub Actions đã chạy thành công cho Windows/Linux trên commit phát hành 0.3.1: [CI run](https://github.com/HiTranquility/RelayCrew/actions/runs/38869969638).

0.3.1 tổ chức source thành `core`, `host`, `adapters`, `storage`, `ui`; chuyển hợp đồng backlog về core, cập nhật imports của tests/preview và giữ nguyên entry point cùng các ID `aiTeam.*`. Source được đưa vào clone `HiTranquility/RelayCrew` và push lên `main`, commit `c2b3107`, tag `v0.3.1`. Các kiểm tra được chạy lại từ thư mục mới.

Giữ riêng VSIX gốc 0.1.0/0.2.0/0.3.0 cùng source khôi phục từ source map; bản 0.3.1 có source snapshot gồm tests/scripts/lockfile. Mỗi bản có notes, metadata và SHA-256; `npm run releases:verify` kiểm tra toàn bộ. Thêm hai tests kiểm tra archive bị thay đổi và từ chối tag không khớp package version.

[Release workflow](https://github.com/HiTranquility/RelayCrew/actions/runs/38869970855) đã chạy thành công và tạo [GitHub prerelease 0.3.1](https://github.com/HiTranquility/RelayCrew/releases/tag/v0.3.1) với VSIX và SHA256SUMS. Notes/source trong archive giữ nguyên bản chụp trước khi publish; trạng thái trong các bản chụp phản ánh thời điểm lưu. Chưa publish lên Marketplace.

## 0.4.0 validation

- Strict TypeScript and production bundle checks.
- 64 automated tests: existing transport/state/quota coverage plus daily exclusions/budgets/decisions, primary/coordinator authority, bilingual message/NLS coverage, numeric settings, project paths/deep-link encoding and real temporary Git worktrees.
- Worktree tests create actual isolated checkouts, verify source preservation, repeated preparation/recovery, nested folders, dirty-source rejection, branch validation and provider-call suppression on preparation failure. All Git repositories/accounts used here are local test fixtures.
- Optional browser QA with Playwright/Edge checks English/Vietnamese, dark/light themes, tab/keyboard navigation, drafts surviving refresh, settings messages, account exclusion and management selection, Projects actions and narrow Setup layout. Screenshots in `previews/` use demo data.
- Native VS Code smoke checks activation, all contributed commands, live English/Vietnamese board/flow title changes and Setup/Daily/Projects commands in an isolated editor profile.
- `npm audit --audit-level=high`: no reported vulnerabilities at the local check time.

Provider authentication, real paid model calls, live Telegram/Zalo delivery and desktop deep-link handoff into the installed app have not been exercised. Deep-link construction follows official documentation; it is not evidence of automatic desktop sidebar project creation. No such public API was identified. Browser QA tests rendering and messages, not the real VS Code webview sandbox. Native smoke checks the extension host separately. Remote CI status is reported only after push/run completion.

## 1.1.0 validation

- Type checking, bundle/package build, 212 automated tests and immutable archive checks. New coverage exercises host-bound review invalidation, current quota checks, normalized public progress, identical observer status, crash recovery, budget preservation, portable evidence privacy and protected retention candidates.
- Browser fixture checks cover English/Vietnamese, dark/light, narrow layouts, inline review and keyboard confirmation, changed drafts, direct Chat, setup, native-style child views, canvas movement, directions, session groups and storage preview/confirmation. These checks make no paid model calls.
- Native isolated VS Code activation verifies every contributed command, bilingual board navigation, detached Map/Live/files views, one local fake HTTP chat, completion notices and queued cancellation. The user profile and real login sessions are not used by this test.
- CI now runs browser readiness checks as well as Windows/Linux unit/package checks. Remote run success must be verified for the final release commit; a workflow file alone is not completion evidence.
