# Projects and Codex integration

RelayCrew 0.4 groups tasks automatically by their source project folder (`Job.sourceCwd`, or `Job.cwd` for shared tasks). Open VS Code roots appear even when empty. Historical folders stay visible while their tasks are retained. This is a derived view of persisted jobs, so there is no second project database to drift from task history. Separate workspace roots remain distinct; task worktrees stay grouped under their source project. Account/model labels on active tasks use recorded execution data.

The board can create a task in an open root, reveal a known folder, or open a new Codex desktop chat for that folder. The host validates the selected path against known roots/history and checks that the local directory exists. Task creation requires the folder to be open in the trusted workspace. Webview messages cannot supply arbitrary commands or URL schemes.

## Desktop connection

The current connection is the documented `codex://threads/new?path=<encoded-absolute-path>` deep link. It prepares a new local chat with the folder as the active workspace. It does not send a prompt, carry account credentials, return a thread ID or grant RelayCrew ownership of that chat. The installed desktop app handles the link and the owner sends subsequent messages there.

Sources checked on 2026-10-16:

- [Desktop commands and deep links](https://learn.chatgpt.com/docs/reference/commands): supported path and prompt parameters; prompts are prepared rather than submitted.
- [Projects and chats](https://learn.chatgpt.com/docs/projects?surface=app): differences between local folder context and app Projects.
- [App Server protocol](https://learn.chatgpt.com/docs/app-server): persistent thread/turn lifecycle and working-directory context for a future two-way connector.

No public sidebar-project creation API was identified in these documents. RelayCrew does not edit the app's internal databases or claim automatic sidebar synchronization. App Server thread creation is distinct from creating a desktop sidebar project. A future connector needs explicit thread ownership, durable mappings, authentication/environment isolation, approvals, cancellation, reconnection and live compatibility tests.

## Automatic task worktrees

`aiTeam.isolateTasks` is an opt-in setting shown in Projects and Setup. Every new manual, remote, schedule, backlog or daily task captures the setting. Old tasks retain shared-folder behavior. Before any provider call, the runner creates a Git branch and checkout in `<workspace-extension-storage>/worktrees/<task-hash>` from committed HEAD. Source must be clean, including untracked files; the extension never auto-commits/stashes source changes. Nested workspace folders retain their relative path within the checkout.

Destinations are checked outside the source repository. Names derive from the task ID hash, not prompt text. Existing checkouts must match the expected Git repository, branch and location. Repeated preparation resumes the same checkout; a checkout created before state was saved can be recovered. Failure or cancellation preserves available data and prevents provider execution. Git must support `--path-format` (Git 2.31+).

All steps of one task use its own checkout. The board shows source project, execution folder and branch; **Open task folder in Codex** targets the checkout. Reports/timeline retain checkout metadata. Source snapshots are taken in the task checkout before editable steps. Worktrees/branches are retained without automatic merge or deletion. They consume disk outside source-backup caps. Preserve extension storage until their changes are integrated; manage cleanup deliberately with Git after checking for uncommitted work. Different tasks start from committed source HEAD, not from another task's unpublished edits.

`aiTeam.openTasksInCodex` optionally opens a folder chat once at task start, after worktree preparation. The attempt is persisted before opening so resuming does not repeatedly launch chats. Failure is shown in Projects; the manual button can retry. A successful OS deep-link handoff does not prove sidebar registration or desktop connection. RelayCrew continues its CLI execution independently; prompts are not auto-sent and chats are not synchronized.

## Tiếng Việt

Bảng **Dự án** tự gom task theo project gốc, hiển thị agent/account thực tế, tiến độ và báo cáo. Bật **Tạo Git worktree riêng cho mỗi tác vụ mới** để có folder/branch riêng trước khi agent chạy. Source phải sạch và đã commit. Giữ lại checkout để kiểm tra, không tự merge/xóa. Có thể bật tự chuẩn bị chat Codex ở thư mục task hoặc bấm mở thủ công.

Deep link không tự gửi yêu cầu hay đổi account. Phiên bản này chưa tự tạo nhóm Projects ở sidebar Codex và chưa đồng bộ hội thoại hai chiều với desktop; không sửa cơ sở dữ liệu nội bộ để giả lập tích hợp.
