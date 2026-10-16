# RelayCrew 0.6.0

Real CLI setup, usable account controls, Markdown workflows, attachments and panel controls.

- Add/edit account profiles inline, detect installed CLI paths, set model/effort and separate Codex/Claude login directories, open CLI login terminals and assign Dev/Audit/Repair/primary-manager roles directly.
- Connect a real CLI and run a read-only three-stage Dev → Audit → Lead trial with the current login. Role buttons select account-based routing; existing task history is preserved.
- Import a UTF-8 Markdown workflow guide with optional version-1 relaycrew configuration. Preview assignments before applying and retain per-task guide snapshots/hashes.
- Pick/drop PNG/JPEG or UTF-8 text/code; paste clipboard images; retain draft snapshots through reload/retry and answer owner questions with attachments. Copy final answers/reports on demand.
- Show/hide sessions and composer; toggle native VS Code sidebar/panel; close/reopen the board while the runner continues. Draft/layout state is retained in local workspace storage.

Limits: 8 attachments / 16 MB per task, 4 MB per PNG/JPEG, 256 KB per text file, retained 256 MB cache. PDF/archive/other binary formats are not supported. Removing a draft chip does not delete its cache snapshot. Back up attachments together with state.

Codex uses native image flags. Claude/Gemini receive scoped temporary paths and must use their image-capable file tools; model/access support is still required. Login is completed by the user. No permission bypass or automatic account creation is introduced. Workflow topology remains the bounded Dev/Audit/optional Repair/Lead pipeline with optional supporting coordinators.

Validation: 78 automated tests, strict TypeScript/build, bilingual light/dark browser QA and native VS Code smoke. An explicitly authorized real Codex trial completed all three read-only stages with 15 public events. Live Claude/Gemini, provider image understanding and remote messaging are not yet verified. See docs/QUICKSTART.md, docs/CONSOLE.md and docs/VALIDATION.md.

## Tiếng Việt

Thêm form tài khoản thật, tìm CLI, thư mục đăng nhập riêng, nút gán vai trò và chạy thử chỉ đọc. Nhập luồng từ Markdown thay vì chọn từng node; xem trước rồi áp dụng. Console hỗ trợ file/ảnh, Ctrl+V dán ảnh, sao chép báo cáo và thu/mở các vùng. Tác vụ giữ bản chụp hướng dẫn/file; các bản phát hành cũ được giữ nguyên. Đã chạy thử Codex thật qua Dev → Audit → manager thành công; các giới hạn và phần chưa kiểm thử được ghi rõ trong tài liệu.
