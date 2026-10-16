# RelayCrew 0.7.0

Inline configuration and a clearer primary manager.

- Add editable input/response templates by role, built-in presets, local preview/reset, Markdown import and per-task snapshots/hashes.
- Make model IDs optional: current Codex catalog recommendation or Claude/Gemini flagship aliases, retained custom pins, reasoning levels and per-account quota ceilings.
- Updated theme-aware navigation, account cards and responsive Setup sections.
- Accent borders, badges, selected role buttons and the final flow node identify the primary manager; supporting coordinators remain clearly labelled.
- Configure accounts, models/effort, team flow, routing pools, manual quota, task account switching and messaging directly in the board. Save/validation feedback stays beside the form.
- Paste or choose a Markdown guide, preview assignments and apply without a separate editor or selection wizard.
- Keep configuration drafts through refresh/reload, update account choices during live snapshots, and exclude passwords from persisted drafts. Connection test/disconnect actions remain available.

Native file selection and interactive CLI login remain available. Scheduling/daily-plan dialogs have not been redesigned in this release. Account labels do not verify login identity; provider quota still requires a real observation. Existing tasks retain their team snapshots and completed account history.

Validation: 92 automated tests, strict TypeScript/build, English/Vietnamese dark/light browser QA and native VS Code smoke with zero input/QuickPick dialogs for common configuration commands. No new paid provider calls or live messaging deliveries were made for this UI release. All earlier version archives remain unchanged.

## Tiếng Việt

Giao diện gọn hơn, làm nổi bật thẻ/nút **Quản lý chính** và ô duyệt cuối trong sơ đồ. Cấu hình tài khoản, model, luồng nhóm, luân phiên, quota, đổi account và kết nối ngay trong bảng, có nút lưu/lỗi tại chỗ. Markdown có thể dán, xem trước rồi áp dụng. Bản nháp được giữ khi cập nhật; giá trị secret không lưu trong bản nháp. Hộp chọn file và đăng nhập CLI vẫn dùng công cụ gốc. Giữ nguyên các bản phát hành trước.
