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

0.3 bổ sung tests cho nhiều quota windows, file source có giới hạn đọc, account thực trong status bar, pin account cho task và múi giờ hệ thống. GitHub Actions được cấu hình cho Windows/Linux; chưa có remote CI run trong repo GitHub ở phiên này.

0.3.1 tổ chức source thành `core`, `host`, `adapters`, `storage`, `ui`; chuyển hợp đồng backlog về core, cập nhật imports của tests/preview và giữ nguyên entry point cùng các ID `aiTeam.*`. Source được đưa vào clone `HiTranquility/RelayCrew`; chưa commit hoặc push. Các kiểm tra được chạy lại từ thư mục mới.

Giữ riêng VSIX gốc 0.1.0/0.2.0/0.3.0 cùng source khôi phục từ source map; bản 0.3.1 có source snapshot gồm tests/scripts/lockfile. Mỗi bản có notes, metadata và SHA-256; `npm run releases:verify` kiểm tra toàn bộ. Thêm hai tests kiểm tra archive bị thay đổi và từ chối tag không khớp package version. Release workflow chỉ publish khi tag được push; chưa tạo tag hoặc GitHub release trong phiên này.
