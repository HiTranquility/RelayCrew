# RelayCrew 0.9 workbench

## Daily work

1. Open **Daily quota tasklist**, import local folders, then check the folders to include.
2. Choose each folder's permission: **Read only**, **Auto** (the CLI's workspace-edit mode), or **Full**. Full requires a confirmation naming the folders; native full mode can access beyond those folders. Both global Allow Edits and daily editing must also be on for editable Dev/Repair steps. Audits and managers stay read-only.
3. Include the desired accounts. Excluded accounts are also unavailable for manager/coordinator work.
4. Set the daily deadline/timezone, task count and quota target. Choose **Save plan without starting** to prepare it. **Save and start** dispatches useful work while this VS Code workspace is running.
5. Add tasks and their own Definition of Done. Each row shows actual phase progress, running account, results, blockers, flow and owner checklist. Phase progress is distinct from owner acceptance and does not predict an ETA.

**Daily model budgets** combine an account and model policy. Use `*` for every model, `@automatic` for automatic flagship selection, `@cli` for CLI settings, or an optional exact custom ID. Configure separate rows for different policies. An exact ID budget applies when that custom policy is selected; it does not identify models chosen by an automatic catalog.

The lowest plan/account/model-policy quota ceiling wins. Agent-run budgets count all assigned roles and retries. Their counters persist for that plan day, including previous accounts used by a retried step. A limit can pause a task between Dev, Audit and Manager. It does not interrupt an in-flight request or guarantee an exact token spend.

Quota sources are explicit manual snapshots or local quota JSON files. Before/after measurements retain their source and observation timestamps. Repeated observations, resets and source changes do not yield a usage delta. Percentage points are not token counts and can include other activity on the same account. Configure a source and refresh it; unknown or stale quota pauses automatic dispatch. Historical observations are retained as evidence, not current availability.

Remote GitHub/GitLab login is reserved for the future **0.9.6 feature scope**. There is no v0.9.6 release in this local-workspace series.

## Console and input

Open **Layout and shortcuts** to place the prompt below/beside the monitor, adjust text size/density and reset or export/import layout. Layout files contain only validated layout preferences. Drag or keyboard-resize dividers; double-click/Enter resets a divider, Escape cancels a drag. Narrow editors stack panes automatically.

Enter/Shift+Enter and Ctrl/Command+Enter follow the selected send preference. Alt+1…8 changes page, Alt+I focuses the prompt, Alt+F searches tasks, Alt+S/E toggles panes, Alt+L opens layout. Configure host shortcuts in VS Code's keyboard shortcut editor.

Supported inputs: UTF-8 text/code/Markdown/CSV/JSON/YAML, PNG/JPEG/WebP/GIF, DOCX/ODT extracted text, and PDF snapshots for CLI document tools. Documents/images are at most 4 MB, extracted text at most 256 KB, eight attachments/16 MB total. DOCX/ODT extraction follows no external resources/macros and rejects oversized XML/entities. It does not preserve document layout or embedded images. GIF/model support depends on the selected provider. HTTP adapters accept extracted text/images but reject PDF. CLI agents must ask for text when PDF tools/OCR are unavailable. Antigravity currently accepts only text context; see [its adapter limitations](ANTIGRAVITY.md).

**Voice input** inserts a draft; it never sends automatically. In VS Code on Windows, focus the prompt and use **Win+H** system dictation. Browser recognition is optional, requires explicit opt-in and is often unavailable in VS Code webviews. Its service may process audio remotely. RelayCrew stores the resulting text draft, not audio. Unsupported environments display system-dictation guidance. Automated QA simulates speech events; physical microphone transcription has not been validated.

## Accounts, filters and backlog

Accounts → **Check all accounts** checks CLI installation/auth status where supported, API catalogs, and missing SecretStorage references. A configured label is not a verified email identity. These checks do not make a model inference request. Installation detects an existing CLI before showing a confirmation; Sign in opens a visible terminal for you.

Use **Manage account secrets** on a card. Secret values are password fields, never returned to the webview or included in drafts/layout. Delete removes the named credential only after confirmation. Use **Include** to require comma-separated phrases and **Exclude** to omit any matching phrase. Accounts, Daily items, Daily accounts, Projects and Backlog have pagination. Tasks also retain their status filter and page size.

Tasks → **Useful backlog** adds bounded work, configures a run/time budget and removes pending entries inline. Fresh quota is required for all assigned roles. The global pause button stops execution while preserving edits. Retry receipts prevent an acknowledged form submission from creating the same item again; edited drafts survive acknowledgements and snapshots.

## Telegram and Zalo

Setup → **Messaging connections** contains the Bot/OA token and Zalo webhook secret fields. They are stored in VS Code SecretStorage, separate from JSON state and backups. Blank credentials on an existing connection keep stored values; supplying a new value rotates it. Disconnect removes credentials. A first connection requires credentials.

Two-way Telegram restricts both chat ID and sender ID. Zalo OA requires App ID, OA ID, sender/recipient, signed webhook secret and a public HTTPS route to the local listener. Configure the public endpoint yourself. Tests send a real message to the configured recipient only when explicitly requested. Chat supports questions, tasks, status, cancellation, resume and owner replies. Remote repo authentication is separate and not implemented.

VS Code and this workspace must stay open. Uncertain deliveries are not automatically resent after recovery. Editing transport settings for the same identity preserves conversation context; changing identity/credentials clears its active context and cancels pending deliveries. Historical inbox/outbox records remain local. Real Telegram/Zalo credentials were not used for release QA; tests use a local signed webhook and mocked outbound transport.

Tiếng Việt: Daily lưu kế hoạch, thư mục/quyền, checklist và định mức theo account/model. Chỉ báo số quota đã quan sát, không suy ra token. Console tách ô nhập với màn hình theo dõi; voice tạo bản nháp, Windows dùng Win+H khi webview chưa hỗ trợ. Secret nằm tại **Accounts → Manage account secrets** và **Setup → Messaging connections**, được lưu qua SecretStorage. Bộ lọc và phân trang giữ lựa chọn sau reload. Các kết nối thực cần bạn đăng nhập/cấp token; extension không tự đăng nhập thay bạn.
