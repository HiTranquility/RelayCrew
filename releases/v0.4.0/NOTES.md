# RelayCrew 0.4.0

English/Vietnamese UI, native VS Code configuration, daily quota planning and observable project folders.

## Changes

- English/Vietnamese runtime language selection, localized Command Palette/Settings labels and README.vi.md.
- Compact theme-aware Tasks, Accounts, Setup, Daily and Projects tabs with keyboard navigation, persistent drafts and validated settings. Native dialogs edit profiles, environment variables and secret names.
- Explicit primary manager with up to four read-only supporting coordinators. Only the primary can finalize; quota fallback cannot silently transfer authority.
- Opt-in daily account inclusion/exclusion, quota targets and task budgets. Durable owner decision log; bounded independent code/UIUX/hotkey/conventions/CI reviews. Fresh quota required; no dummy token-burning requests.
- Projects board groups tasks by source folder and displays actual active accounts. Optional per-task Git worktrees from clean committed HEAD retain branches/changes for review, without automatic merge/deletion.
- Optional one-time Codex desktop chat preparation at the task folder through a documented deep link. It does not send prompts, change desktop accounts or synchronize CLI sessions. Automatic Codex sidebar project-group creation is not implemented; no public API was identified.

## Validation and limits

64 automated tests passed locally, including real temporary Git worktrees, subprocess/transport fixtures, quota/decision/management policies, localization and project paths. Strict TypeScript, production build, VSIX packaging, English/Vietnamese native VS Code smoke and four browser language/theme combinations passed. Live paid providers, real Telegram/Zalo accounts and desktop deep-link handoff have not been exercised. GitHub CI runs again on the release tag.

Git 2.31+ is required for task worktrees. Source must be clean; the extension never commits/stashes owner work. Worktrees consume disk outside source-backup caps and remain in workspace extension storage until deliberately managed. Keep the source repository and storage while those checkouts are needed. Daily budgets count tasks rather than exact tokens/cost. Important-decision detection depends on the agent following needs_owner.

## Tiếng Việt

Bản này thêm UI Anh–Việt theo VS Code, cấu hình qua form, quản lý chính/điều phối phụ, tasklist quota ngày có loại trừ account và ghi quyết định, bảng Dự án và Git worktree riêng cho task. Có thể tự chuẩn bị chat Codex đúng folder; chưa tự tạo nhóm sidebar Codex. Các bản 0.1.0/0.2.0/0.3.0/0.3.1 giữ nguyên.

## Archives

This directory preserves the local VSIX, a source snapshot, release.json and SHA256SUMS. The source ZIP includes tests/scripts/lockfile/localizations/docs, excludes dependencies/build output/Git history/the release catalog, and contains no runtime account data. GitHub-generated source represents the tagged commit. A CI-built VSIX can differ in ZIP timestamps/checksum; verify the checksum shipped with the particular download. Never replace an archived asset with a rebuild.
