# RelayCrew 0.8.0

Chat, keyboard controls, CLI onboarding and roles you can customize.

- One-account read-only chat for greetings/questions; explicit team-task mode for implementation/audit/manager work.
- Enter sends, Shift+Enter adds a line; optional Ctrl+Enter sending, IME/pending guards, inline form saving and global shortcuts.
- Readable replies above expandable activity; no duplicate Claude partial/full response display.
- Visible Install CLI / Sign in / Check connection actions; missing CLI is reported before dispatch. Install/login use dedicated terminals, with authentication completed by the user.
- Separate role controls in each card corner. One account can cover multiple roles; only one primary manager is selected.
- Prompt-pencil navigation, role display names and per-role UTF-8 Markdown guides up to 32 KB, saved in task snapshots/hashes.

Validation: 99 automated tests, bilingual light/dark browser QA, strict TypeScript/build and native VS Code smoke. A real Codex `hello` chat completed with one read-only model call and no repository-tool/audit/manager activity. Global installs and interactive sign-in were not executed in automated tests. Earlier release archives remain unchanged.

## Tiếng Việt

Chat trả lời một lượt; giao việc nhóm chạy luồng riêng. Enter gửi, Shift+Enter xuống dòng, có chọn Ctrl+Enter và phím tắt mở bảng/chat/task/tạm dừng. Thẻ account có nút cài/đăng nhập/kiểm tra và ô phân vai ở góc phải, Manager chính chọn độc quyền. Bấm bút để sửa prompt, đổi tên vai trò, đính kèm hoặc chỉnh hướng dẫn .md riêng. Đã chạy thử Codex thật với hello: một lượt, không kiểm định repo. Các bản cũ được giữ nguyên.
