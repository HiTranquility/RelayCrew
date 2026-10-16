# Connect accounts and import workflows / Kết nối tài khoản và nhập luồng

## Run with a real CLI

1. Open a trusted local project in VS Code. Open RelayCrew → **Setup → Connect local CLI & try it**.
2. Select Codex, Claude or Gemini. RelayCrew finds common installed executable paths; confirm or change the path. The version check runs locally without a model call.
3. Enter an exact model ID and reasoning effort, or leave them empty to use CLI defaults.
4. Choose **Save, use for new tasks and run read-only trial**. This selects account-based routing, assigns that account to Dev, Audit and the primary manager for future tasks, clears role model overrides, and runs three real CLI calls. The trial reads only the project's root `package.json`; audit and lead verify that answer. The workspace queue must be active. Existing tasks retain their assignments.

Authentication uses the CLI's existing login. RelayCrew does not manufacture quota or verify an email from a configured profile. If authentication fails, open **Accounts & quota → Open CLI login**, complete the login yourself, then run another trial. RelayCrew does not install missing CLIs.

For different accounts, use **Add account** in **Accounts & quota**. Set the label, provider, executable, model and effort. Codex/Claude can use an absolute, separate configuration folder (`CODEX_HOME` / `CLAUDE_CONFIG_DIR`); sign in within that profile's login terminal. Leaving the folder empty uses the current CLI login. Two labels pointing to the same login directory are not two authenticated accounts. Gemini environment isolation is available through advanced profile settings. Credentials stay with the CLI or VS Code SecretStorage.

Role buttons immediately assign the selected account to **new tasks** and select account-based routing (turning off round robin). The manager button changes primary authority and removes that same account from supporting coordinators. To switch an existing session, use its **Switch account** button: running work is paused, then choose the unfinished role and replacement profile. Completed steps keep their recorded account/model. Read-only trials use the chosen profile for all three roles and do not change the normal flow.

## Import a Markdown workflow

Use **Setup → Import workflow from Markdown** and choose a UTF-8 `.md` file up to 64 KB. Ordinary Markdown becomes a shared workflow guide while preserving account assignments. A single optional `relaycrew` fenced block containing version-1 JSON can set `flow`, `roles`, `overrides`, and `management`. See [the bilingual example](workflow.example.md). Unknown accounts or settings are rejected; configure the referenced profiles first. Executables, credentials and arbitrary commands cannot be imported in this block.

The preview shows account assignments and source Markdown. **Apply workflow for new tasks** saves the guide and opens the visual flow editor. Supported topologies are Dev → Audit → Lead, with optional Repair before Lead, plus up to four supporting coordinators. This is a bounded pipeline, not an arbitrary DAG. Use the Markdown prose for coding conventions, review criteria and role responsibilities. Agents receive the complete guide plus their assigned role. The guide cannot bypass edit permissions, authorize publishing or create extra agents. New normal and daily tasks keep a guide snapshot/hash in their saved state and reports. Removing the guide affects future tasks only; role assignments stay configured. Scheduled tasks capture the currently selected guide when dispatched.

## Show and hide panels

**Show / hide sessions** and **Show / hide composer** control the Console layout; choices survive refreshes. **New task** or **Reply here** reopens a hidden composer. The board's **⋯** menu toggles the VS Code sidebar/panel or closes the RelayCrew editor tab. Closing the tab does not stop the runner. Reopen it from the activity bar/status bar or **RelayCrew: Open Assignment Board**. Use **Pause immediately** to stop the process and retain edits.

## Tiếng Việt

Vào **Thiết lập → Kết nối CLI thật & chạy thử**, chọn nhà cung cấp, kiểm tra đường dẫn CLI, chọn model/effort hoặc để mặc định. Chọn **Lưu, dùng cho tác vụ mới và chạy thử chỉ đọc** để dùng tài khoản đó cho Dev → Audit → manager và chạy ba lượt CLI thật. Tác vụ thử chỉ đọc `package.json`, không sửa code. Hàng đợi phải đang bật.

Vào **Tài khoản và quota → Thêm tài khoản** để lưu profile ngay trong form. Nút **Tìm CLI đã cài** điền đường dẫn. Codex/Claude có thể dùng thư mục đăng nhập riêng; bấm **Mở đăng nhập CLI** và tự hoàn tất đăng nhập. Đổi tên profile không tạo tài khoản mới nếu vẫn dùng cùng thư mục đăng nhập. Nút vai trò trên từng thẻ đổi phân công cho tác vụ mới. Nút **Đổi tài khoản** trong phiên dùng cho việc còn dở và tạm dừng tiến trình trước khi đổi.

Vào **Thiết lập → Nhập luồng từ Markdown**, chọn `.md` UTF-8 tối đa 64 KB. File thường làm hướng dẫn chung; khối `relaycrew` trong [file mẫu](workflow.example.md) cho phép đặt tài khoản/model/manager mà không chọn từng node. Xem trước rồi áp dụng, sau đó kiểm tra sơ đồ. Tài khoản chưa có phải được cấu hình trước. Luồng hỗ trợ Dev → Audit → Lead, có thể thêm Repair và coordinator; chưa hỗ trợ đồ thị tùy ý. Tác vụ mới giữ bản chụp hướng dẫn, tác vụ cũ giữ bản đã lưu.

Console có nút ẩn/hiện danh sách phiên và ô nhập. Menu **⋯** bật/tắt sidebar, panel VS Code hoặc đóng bảng. Đóng bảng vẫn giữ runner chạy; dùng **Tạm dừng ngay** nếu muốn ngưng công việc.

## Optional live integration test

After `npm run build`, run `scripts/live-trial.mjs` with absolute paths to VS Code and an authenticated Codex executable. Set `RELAYCREW_LIVE_TEST=1` explicitly. It opens an isolated VS Code user profile, uses the normal extension command/engine, makes three real CLI calls with the current CLI login, checks completion/public output, and writes results under the system temporary directory. It does not run in CI or `npm test`. The trial project is the current RelayCrew repository; no source edits are enabled.
