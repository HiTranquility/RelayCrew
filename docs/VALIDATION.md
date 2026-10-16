# Validation · 0.3.1 · 16/10/2026

- TypeScript strict check: passed.
- 38 unit/integration tests: passed locally on Windows.
- Native VS Code Extension Development Host: activated; all contributed commands registered; Assignment Board và Setup Flow mở thành webview tabs.
- UI preview HTML rendered with a Chromium-based headless browser; flow và board images inspected. Preview dùng dữ liệu demo, không phải account/model/session đang hoạt động.
- npm audit, cả development dependencies: 0 vulnerabilities tại thời điểm kiểm tra.

Tests bao phủ phân vai, flow 3/4 bước, owner question/reply, không replay bước đã hoàn thành, pause ngay, shutdown, quota wait, round robin, backlog budgets, streaming output, lọc public text khỏi thinking, CLI timeout/cancel tree, shell quoting, token redaction, sender allowlist, webhook raw-body signature, chống nhận trùng, outbox uncertainty, state recovery và source snapshot.

API/CLI integration dùng fake transport/CLI hoặc local signed HTTP webhook. Chưa gửi tin bằng bot/OA thật, chưa chạy task bằng provider account thật, chưa xác minh model ID của người dùng, chưa kiểm tra OAuth refresh hoặc public HTTPS forwarding Zalo. Cần credential và cấu hình môi trường của owner để kiểm thử live.

Preview:

- `previews/flow.html`, `previews/flow.png`.
- `previews/board.html`, `previews/board.png`.

Chạy lại bằng `npm run check`, `npm test`, `npm run build`. Native smoke: `node scripts/smoke.mjs /absolute/path/to/your/code-executable`. Tạo HTML demo: `npm run preview`.

0.3 bổ sung tests cho nhiều quota windows, file source có giới hạn đọc, account thực trong status bar, pin account cho task và múi giờ hệ thống. GitHub Actions đã chạy thành công cho Windows/Linux trên commit phát hành 0.3.1: [CI run](https://github.com/HiTranquility/RelayCrew/actions/runs/38869969638).

0.3.1 tổ chức source thành `core`, `host`, `adapters`, `storage`, `ui`; chuyển hợp đồng backlog về core, cập nhật imports của tests/preview và giữ nguyên entry point cùng các ID `aiTeam.*`. Source được đưa vào clone `HiTranquility/RelayCrew` và push lên `main`, commit `c2b3107`, tag `v0.3.1`. Các kiểm tra được chạy lại từ thư mục mới.

Giữ riêng VSIX gốc 0.1.0/0.2.0/0.3.0 cùng source khôi phục từ source map; bản 0.3.1 có source snapshot gồm tests/scripts/lockfile. Mỗi bản có notes, metadata và SHA-256; `npm run releases:verify` kiểm tra toàn bộ. Thêm hai tests kiểm tra archive bị thay đổi và từ chối tag không khớp package version.

[Release workflow](https://github.com/HiTranquility/RelayCrew/actions/runs/38869970855) đã chạy thành công và tạo [GitHub prerelease 0.3.1](https://github.com/HiTranquility/RelayCrew/releases/tag/v0.3.1) với VSIX và SHA256SUMS. Notes/source trong archive giữ nguyên bản chụp trước khi publish; trạng thái trong các bản chụp phản ánh thời điểm lưu. Chưa publish lên Marketplace.

## 0.4.0 validation

- Strict TypeScript and production bundle checks.
- 64 automated tests: existing transport/state/quota coverage plus daily exclusions/budgets/decisions, primary/coordinator authority, bilingual message/NLS coverage, numeric settings, project paths/deep-link encoding and real temporary Git worktrees.
- Worktree tests create actual isolated checkouts, verify source preservation, repeated preparation/recovery, nested folders, dirty-source rejection, branch validation and provider-call suppression on preparation failure. All Git repositories/accounts used here are local test fixtures.
- Optional browser QA with Playwright/Edge checks English/Vietnamese, dark/light themes, tab/keyboard navigation, drafts surviving refresh, settings messages, account exclusion and management selection, Projects actions and narrow Setup layout. Screenshots in `previews/` use demo data.
- Native VS Code smoke checks activation, all contributed commands, live English/Vietnamese board/flow title changes and Setup/Daily/Projects commands in an isolated editor profile.
- `npm audit --audit-level=high`: no reported vulnerabilities at the local check time.

Provider authentication, real paid model calls, live Telegram/Zalo delivery and desktop deep-link handoff into the installed app have not been exercised. Deep-link construction follows official documentation; it is not evidence of automatic desktop sidebar project creation. No such public API was identified. Browser QA tests rendering and messages, not the real VS Code webview sandbox. Native smoke checks the extension host separately. Remote CI status is reported only after push/run completion.
