# Product roadmap

## 0.3 · Public repository preparation

README tiếng Anh, MIT copyright HiTranquility, contribution guide, architecture/configuration boundaries, Windows/Linux CI definition và tên hiển thị RelayCrew. Giữ command/settings/extension IDs để tương thích bản local. Tách quota source, hỗ trợ nhiều windows, status bar theo account thực, switch task có pause/pin, timezone hệ thống và packaging portable. Chưa publish GitHub/Marketplace trong phiên phát triển.

## 0.1 · MVP đã triển khai

Sidebar, status bar, chọn profile theo vai trò, pipeline CLI, audit JSON/issue draft, task con tuần tự có giới hạn, kết luận tech lead, lịch once/cron, reminder, quota manual/file adapter, auto-switch trước bước tiếp theo, cancel cây tiến trình, SecretStorage và báo cáo lưu bền.

Đây là orchestrator của các phiên CLI riêng. Task con là đơn vị việc do workbench giao; chưa phải cây native subagents bên trong từng CLI.

## 0.2 · Đã triển khai bổ sung

Setup flow 3/4 node, board quan sát/live transcript công khai, input/output, immediate pause/resume, owner questions/replies, round-robin pool, quota wait/resume, backlog hữu ích có budget, state recovery/backup, source snapshots, Telegram long polling và Zalo OA webhook hai chiều. Kết nối thật cần credential và HTTPS forwarding của owner. Xem OPERATIONS.md và CONNECTIONS.md.

## Tiếp theo · Reliability và account

- Preflight phiên bản CLI, đăng nhập và khả năng model trước khi enqueue; catalog model lấy từ provider thay vì hard-code tên “mạnh nhất”.
- Chuẩn hóa capability: model, effort, context, cost, quyền, concurrency; owner chọn vai trò hoặc policy minh bạch chọn model trong danh sách cho phép.
- Adapter quota có nguồn chính thức: nhiều cửa sổ 5h/tuần/ngày, reset, tiền và token. Adapter báo unknown khi provider không cung cấp; không scrape session không được hỗ trợ.
- Account identity verification, logout/login trong terminal, xóa secret, edit/delete schedule, archive history, retention và per-project budgets.
- Resume từng bước có checkpoint/diff để tránh nhân đôi thao tác khi timeout/host crash.

## Tiếp theo · Worktrees và agent tree

- Mỗi run/work item sửa code trong Git worktree riêng; checkpoint đầu/cuối, kiểm tra branch và trạng thái dirty.
- Gemini worker có thể nhận nhiều việc độc lập đồng thời theo quota/cost/concurrency budget.
- Claude review evidence và đề xuất quyết định; Codex tổng hợp tech lead; user là product owner và xem diff/issue/report.
- Native child agents phải khai báo budget và gửi sự kiện có parent ID về orchestrator. Không để mỗi CLI tự nhân cây không giới hạn.
- Tách editor permissions khỏi publication permissions; chỉ gửi GitHub issue/PR sau khi owner bật hành động đó cụ thể.

## 0.4 · Background service

- Tách `domain`, scheduler, storage và engine khỏi VS Code host. VS Code là client của local daemon có authenticated IPC.
- Daemon sở hữu durable queue, lease/heartbeat, idempotency key, lịch IANA timezone, missed-run policy và cancellation.
- Chạy như Windows Scheduled Task/service theo lựa chọn cài đặt rõ ràng; khởi động lại máy vẫn giữ lịch. Không gọi VS Code API trong daemon.
- Migration state có backup, versioned schema, retention và retry policy theo từng bước.

## Kênh giao tiếp · thiết kế mở rộng: Telegram, Zalo và kênh khác

Adapter local đã triển khai trong 0.2; daemon vẫn cần cho chạy khi VS Code đóng. Chưa nhập credential hay gửi tin qua account thật trong phiên phát triển. Telegram và Zalo là các adapter tùy chọn; không đưa logic nghiệp vụ của task vào từng nền tảng chat.

- Bot token qua SecretStorage/OS credential store; allowlist chat/user ID; pairing có thời hạn.
- Trước tiên chỉ gửi completion, failure, required action và reminder. Không spam khi trạng thái không đổi; không gửi source code/token mặc định.
- `/status`, `/tasks`, `/report`, `/cancel`, `/new` đi qua cùng command bus và ownership policy; phân biệt rõ câu hỏi và lệnh chạy.
- Notification outbox có event ID và retry/backoff tránh gửi trùng. Lệnh Telegram chứa task ID để điều phối đúng workspace.
- Chỉ nhận task khi người dùng chủ động bật remote control; nhận lệnh và gửi tin là hai tùy chọn riêng.

### Zalo

- Đánh giá kênh tích hợp chính thức, điều kiện account/app, quyền gửi tin và webhook theo tài liệu hiện hành trước khi chọn phương án triển khai.
- Không giả định khả năng bot cá nhân hoặc mọi tài khoản Zalo có API tương đương Telegram; capability của từng kênh phải hiển thị rõ trong UI.
- Dùng chung pairing, allowlist, notification outbox, deduplication và task ownership; mỗi nền tảng tự xác thực webhook, token và hạn mức.
- Owner có thể chọn Zalo nhận reminder, Telegram nhận báo cáo, hoặc một kênh duy nhất. Khóa định danh owner/workspace độc lập với chat ID để tránh giao nhầm repo.

### Interface dự kiến

```ts
interface MessagingChannel {
  id: 'telegram' | 'zalo' | string;
  capabilities: { notify: boolean; receiveCommands: boolean; attachments: boolean };
  send(notification: { eventId: string; recipientId: string; text: string }): Promise<void>;
  verifyIncoming(request: unknown): Promise<{
    channelUserId: string; workspaceId: string; command: string; requestId: string;
  } | undefined>;
}
```

Adapter chỉ xác thực/chuẩn hóa message. Command bus trung tâm kiểm tra quyền, scope workspace và idempotency trước khi tạo/cancel task. Cấu hình cho phép bật notification và inbound commands riêng theo kênh.

## Event contract dự kiến

```ts
interface TeamEvent {
  version: 1;
  id: string;
  runId: string;
  parentTaskId?: string;
  type: 'queued' | 'step_started' | 'step_completed' | 'quota_changed'
      | 'needs_owner' | 'completed' | 'failed' | 'reminder';
  occurredAt: string;
  workspaceId: string;
  profileId?: string;
  reportPath?: string;
  summary: string;
}
```

Adapters thực thi nhiệm vụ; engine quyết định chuyển bước; policy chọn profile và budget; owner quyết định yêu cầu sản phẩm. Provider report là evidence, không phải quyền mở rộng tool/đăng nội dung/gửi tin.
