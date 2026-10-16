# RelayCrew 0.5.0

Live CLI orchestration console and a clearer workspace overview.

## Changes

- Default Live console with an inline multiline composer, session sidebar, actual running profile/model, elapsed time, working folder and public CLI event feed.
- Ctrl+Enter submits; Enter adds a new line. New Task now focuses the composer rather than opening a one-line input dialog.
- Application commands: /new, /reply, /pause, /resume, /stop, /status. Tasks use the existing flow, CLI adapters, account routing, edit controls, worktrees and backup engine.
- Inline owner replies are scoped to session/question version. Persisted submission/reply IDs prevent duplicate work when retrying.
- Streaming patches session output without replacing the composer. Drafts, selected session, follow preference and task filters survive refresh. Scrolling upward pauses follow output.
- Overview with configured role/account cards, observed quota meters, current work, recent handoffs and first-run guidance. Search/status filters and recorded-step rails simplify task inspection.
- English/Vietnamese and VS Code light/dark themes retained. Prior release archives remain unchanged.

## Validation and limits

69 automated tests passed locally. Strict TypeScript, production build, VSIX packaging, native VS Code English/Vietnamese smoke and browser checks in all four language/theme combinations passed. Console tests cover command parsing, root/session validation, task/reply deduplication, stale-question rejection, real engine progression and escaped public output. Browser checks cover multiline submission, inline errors, retained drafts, snapshot updates, session replies and task filters.

The console displays public events from CLI adapters; it is not a terminal PTY or arbitrary interactive shell. One task runs per workspace. Stream refresh is bounded at roughly 750 ms and depends on provider events. Recent event text is limited; reports retain full step requests/responses. Private reasoning is not shown. Live paid providers and real messaging accounts were not exercised during development. Automatic Codex sidebar project-group creation remains unsupported.

## Tieng Viet

Ban nay them Console truc tiep: nhap nhieu dong, chon phien, theo doi CLI va agent chuyen viec, tra loi ngay tai cho, pause/resume/stop. Co Tong quan moi va tim/loc task. Khong mo hop thoai mot dong khi giao task moi. UI day du co tieng Viet co dau. Khong tu gui yeu cau paid trong kiem thu, khong ghi de archive cu.

## Archives

This directory preserves a local VSIX and source snapshot with release.json and SHA256SUMS. Source includes tests/scripts/lockfile/localizations/docs; excludes dependencies/build output/Git history/release catalog/runtime account data. GitHub-generated source represents the tagged commit. A CI VSIX can differ in ZIP timestamps/checksum: use the checksum supplied with the chosen download. Do not replace an archived asset with a rebuild.
