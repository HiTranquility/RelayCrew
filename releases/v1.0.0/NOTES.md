# RelayCrew 1.0.0

Your AI team in VS Code: choose an approach, assign accounts and observe the work.

- **Plan before execution:** AI suggests editable directions A/B/C with scope,
  implementation steps, proposed file structure, acceptance and tradeoffs.
- **Know capacity:** persistent quota observations, ceilings, provider-limit alerts
  and account switching for unfinished task roles. Missing usage remains unknown.
- **Organize work:** multi-folder task groups, independent task/chat session trees
  and opt-in bounded follow-ups after parent approval. No recursive auto-branching.
- **Observe and control:** draggable/detached Live sessions, agent maps and observed
  file changes, public handoffs, task completion history and keyboard controls.
- **Configure the team:** named auditors/managers, multiple decision makers,
  unanimous/majority/chair policies, editable prompts/Markdown and bounded workers.
- **Use quota on useful work:** maintenance templates, account/model budgets and
  editable Markdown stop gates. Important owner decisions remain paused.

English/Vietnamese UI and instructions included. Install the VSIX in VS Code,
reload the window, then connect your own accounts. Publishing here does not
publish the extension to the VS Code Marketplace.

## Validation and limits

Validated with type checking, automated core/transport tests, bilingual light/dark
and narrow browser checks, drag/resize/hotkey/draft checks and an isolated VS Code
host with a local fake HTTP provider. A real read-only Codex → Claude → Antigravity
worker → Codex manager demo was also completed during development.

Execution is sequential. Native recursive provider agents, automatic cross-repo
merging and exact quota APIs for every provider are not included. File lists are
Git observations, including possible concurrent user edits, not proof of authorship.
Voice input uses browser/system capabilities; physical microphone and live external
Telegram/Zalo credentials were not validated in this release. Antigravity keeps its
documented native CLI capability/permission limitations. Quota targets do not
guarantee exhausting all tokens. Local snapshots/archives exclude previews and
private account configuration; previously published version archives remain unchanged.

## Tiếng Việt

Bản 1.0 thêm phương hướng AI để bạn sửa/chọn, thanh hạn mức, nhóm task nhiều folder,
nhánh task/chat độc lập, panel trực tiếp kéo/tách được, quản lý nhiều phiếu quyết định,
mẫu bảo trì và file Markdown chốt dừng. Cài VSIX, tải lại cửa sổ rồi kết nối tài khoản.
Mọi lượt chạy vẫn theo hàng chờ; việc quan trọng cần bạn quyết định và thiếu quota
sẽ không được giả định là còn token. Xem INSTRUCTIONS.vi.md và bộ mẫu để cấu hình.
