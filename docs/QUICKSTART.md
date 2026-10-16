# Connect accounts and import workflows / Kết nối tài khoản và nhập luồng

## Run with a real CLI

1. Open a trusted local project in VS Code, then **RelayCrew → Accounts & quota → Add account** (or **Connect local CLI**).
2. Choose Codex, Claude or Gemini in the inline form. **Detect installed CLI** fills the executable path; adjust it if needed. Save an account label. Automatic flagship/recommended needs no model ID; Custom model exposes an optional override. Choose effort and a quota ceiling if needed.
3. **Save account**, then use the visible **Install CLI**, **Sign in**, and **Check connection** buttons. Installation uses a dedicated terminal with the provider command shown on the card. Login is completed by you in its terminal/browser. Checking connection makes no model call; Gemini login remains unknown until a trial succeeds.
4. Click **Run read-only CLI trial** on that account. In a single-root workspace the trial starts directly; otherwise select the profile/workspace in the inline trial form. This makes three real CLI calls, Dev → Audit → Lead, and reads only the project's root `package.json`. The queue must be active. Normal flow assignments remain unchanged.
5. In **Setup → Team configuration**, select the three/four-stage flow, account and model/effort for each node, and optional coordinators. The accented **Primary manager** node has final approval. Click **Save team flow**. Account role buttons are a quick alternative for new tasks.

Authentication uses the CLI's existing login. RelayCrew does not manufacture quota or verify an email from a configured profile. If authentication fails, open **Accounts & quota → Open CLI login**, complete the login yourself, then run another trial. Missing CLIs can be installed with the card’s explicit Install CLI action. No install or login starts from sending a message.

For different accounts, use **Add account** in **Accounts & quota**. Set the label, provider, executable, model and effort. Codex/Claude can use an absolute, separate configuration folder (`CODEX_HOME` / `CLAUDE_CONFIG_DIR`); sign in within that profile's login terminal. Leaving the folder empty uses the current CLI login. Two labels pointing to the same login directory are not two authenticated accounts. Gemini environment isolation is available through advanced profile settings. Credentials stay with the CLI or VS Code SecretStorage.

Role checkboxes can give one account several roles. The primary-manager radio is exclusive; choosing another account replaces it. Role controls immediately assign the selected account to **new tasks** and select account-based routing (turning off round robin). The manager button changes primary authority and removes that same account from supporting coordinators. To switch an existing session, use its **Switch account** button: running work is paused, then choose the unfinished role and replacement profile. Completed steps keep their recorded account/model. Read-only trials use the chosen profile for all three roles and do not change the normal flow.

## Import a Markdown workflow

Use **Setup → Workflow from Markdown**, paste your guide into the inline editor or choose a UTF-8 `.md` file up to 64 KB. Ordinary Markdown becomes a shared workflow guide while preserving account assignments. A single optional `relaycrew` fenced block containing version-1 JSON can set `flow`, `roles`, `overrides`, `management` and `promptTemplates`. See [the bilingual example](workflow.example.md). Unknown accounts or settings are rejected; configure the referenced profiles first. Executables, credentials and arbitrary commands cannot be imported in this block.

Click **Preview workflow** to validate account assignments, then **Apply workflow for new tasks** to save the guide and flow in the same board. Editing the Markdown invalidates the previous preview. Supported topologies are Dev → Audit → Lead, with optional Repair before Lead, plus up to four supporting coordinators. This is a bounded pipeline, not an arbitrary DAG. Use the Markdown prose for coding conventions, review criteria and role responsibilities. Agents receive the complete guide plus their assigned role. The guide cannot bypass edit permissions, authorize publishing or create extra agents. New normal and daily tasks keep a guide snapshot/hash in their saved state and reports. Removing the guide affects future tasks only; role assignments stay configured. Scheduled tasks capture the currently selected guide when dispatched.

## Input/output templates and usage

Click the pencil next to a role (or **Edit prompt** in the composer), then select a role/preset, give it an optional display name, attach/edit a UTF-8 `.md` guide up to 32 KB, edit input/response guidance, preview locally and save. New tasks retain snapshots/hashes. See [models and templates](MODELS-AND-TEMPLATES.md).

## Show and hide panels

**Show / hide sessions** and **Show / hide composer** control the Console layout; choices survive refreshes. **New task** or **Reply here** reopens a hidden composer. The board's **⋯** menu toggles the VS Code sidebar/panel or closes the RelayCrew editor tab. Closing the tab does not stop the runner. Reopen it from the activity bar/status bar or **RelayCrew: Open Assignment Board**. Use **Pause immediately** to stop the process and retain edits.

## Tiếng Việt

Vào **Tài khoản và quota → Thêm tài khoản**, nhập nhà cung cấp, đường dẫn CLI, model/effort rồi lưu trong form. Trên thẻ tài khoản bấm **Chạy thử CLI chỉ đọc** để chạy Dev → Audit → manager bằng profile đó. Tác vụ thử chỉ đọc `package.json`, không sửa code hoặc đổi sơ đồ bình thường. Hàng đợi phải đang bật.

Vào **Tài khoản và quota → Thêm tài khoản** để lưu profile ngay trong form. Nút **Tìm CLI đã cài** điền đường dẫn. Codex/Claude có thể dùng thư mục đăng nhập riêng; bấm **Mở đăng nhập CLI** và tự hoàn tất đăng nhập. Đổi tên profile không tạo tài khoản mới nếu vẫn dùng cùng thư mục đăng nhập. Nút vai trò trên từng thẻ đổi phân công cho tác vụ mới. Nút **Đổi tài khoản** trong phiên dùng cho việc còn dở và tạm dừng tiến trình trước khi đổi.

Vào **Thiết lập → Luồng từ Markdown**, dán nội dung hoặc chọn `.md` UTF-8 tối đa 64 KB. File thường làm hướng dẫn chung; khối `relaycrew` trong [file mẫu](workflow.example.md) cho phép đặt tài khoản/model/manager mà không chọn từng node. Xem trước rồi áp dụng, sau đó kiểm tra sơ đồ. Tài khoản chưa có phải được cấu hình trước. Luồng hỗ trợ Dev → Audit → Lead, có thể thêm Repair và coordinator; chưa hỗ trợ đồ thị tùy ý. Tác vụ mới giữ bản chụp hướng dẫn, tác vụ cũ giữ bản đã lưu.

**Thiết lập → Cấu hình nhóm** có sơ đồ 3/4 bước, account/model/effort và điều phối viên phụ. Ô **Quản lý chính** được nhấn màu và có quyền duyệt cuối. Bấm **Lưu luồng nhóm** để áp dụng cho tác vụ mới. Luân phiên, quota thủ công và đổi account của phiên đều có form ngay trong bảng, giữ bản nháp qua cập nhật. Chọn file và đăng nhập CLI vẫn dùng công cụ gốc của VS Code.

Console có nút ẩn/hiện danh sách phiên và ô nhập. Menu **⋯** bật/tắt sidebar, panel VS Code hoặc đóng bảng. Đóng bảng vẫn giữ runner chạy; dùng **Tạm dừng ngay** nếu muốn ngưng công việc.

## Optional live integration test

After `npm run build`, run `scripts/live-trial.mjs` with absolute paths to VS Code and an authenticated Codex executable. Set `RELAYCREW_LIVE_TEST=1` explicitly. It opens an isolated VS Code user profile, uses the normal extension command/engine, makes three real CLI calls with the current CLI login, checks completion/public output, and writes results under the system temporary directory. It does not run in CI or `npm test`. The trial project is the current RelayCrew repository; no source edits are enabled.
