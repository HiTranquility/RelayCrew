# Operating the crew / Điều phối đội — 0.9

## Live session

**Team conversation** shows public assignments, handoffs, replies and current text output directly. Audit JSON becomes a summary, findings and next actions; the manager decision gets a visible badge. Exact assignment text and technical events remain expandable. These are recorded orchestration messages and public provider output, not private model reasoning or an interactive terminal. Provider-internal subagents are only visible if their CLI emits supported public events.

**Hội thoại giữa các agent** hiển thị giao việc, bàn giao, phản hồi và nội dung đang xuất công khai. JSON của Audit được trình bày thành tóm tắt, vấn đề và việc tiếp theo; quyết định của Manager có nhãn riêng. Mở phần nguyên văn hoặc hoạt động kỹ thuật khi cần đối chiếu. Extension không đọc suy luận riêng tư hoặc tự dựng hội thoại chưa xảy ra.

## Many tasks and acceptance

Queue several **Team tasks** from the console. Expand **Definition of Done** in the composer and write one criterion per line. Task cards support search/status filters, show phase progress and owner acceptance separately, and expand into:

- Dev → Audit → optional Repair → Manager flow, with actual recorded accounts/models.
- Individual assignments, supporting coordinator steps and public results.
- Owner-verifiable acceptance checkboxes; additional criteria can be added later.
- Workspace/worktree, attached files, workflow guide/hash and saved role-guide count.
- Agent conversation and full recorded inputs/responses; open the live session or local report.

**Only one task/agent turn runs at a time in this engine.** Many tasks can be queued, waiting or completed. Phase progress reserves future Audit/Manager phases before those steps exist and adds repair steps after audit. It is not code-completion percentage, token-spending progress or an ETA. Owner checkmarks do not approve work on behalf of the manager; manager approval does not mark the owner's checklist. New criteria start unchecked, including pasted Markdown `[x]` entries. Criteria are included in subsequent agent prompts and local reports.

Bạn có thể giao nhiều **Task đội**; chúng vào hàng đợi. Mỗi lần engine chạy một task/một lượt agent. Phần trăm chỉ đếm các bước đã hoàn thành, có dự trù Audit/Manager và có thể thêm bước Repair; không phải phần trăm code hoặc dự đoán giờ xong. Checklist nghiệm thu do bạn đánh dấu, tách riêng với Manager duyệt. Tài liệu hiện ra là ngữ cảnh thực sự gắn với task, không phải một kho trí nhớ tự động.

## Overview

The overview is an action inbox: owner decisions/failures first, active task and queue next, missing fresh quota observations, daily dispatch reason and next scheduled window. Buttons open the relevant session, quota editor or planning page.

Tổng quan ưu tiên việc cần bạn quyết định, lỗi cần xem, việc đang chạy, hàng đợi, quota cần cập nhật và khung lịch sắp tới. Các nút đưa tới đúng nơi xử lý.

## Schedule planner

Open **Schedules** or run **RelayCrew: Schedule / remind me**. Create/edit in the page. Choose a workspace, task/reminder, prompt, optional acceptance criteria, an ISO start with an explicit offset (for example `2026-10-20T09:00:00+07:00`), IANA timezone, optional cron and estimated duration. If start is blank, a cron is required and determines the next occurrence. Cron repeats use the selected timezone. Editing retains the schedule's saved team; new schedules snapshot the current team. Each occurrence gets a fresh unchecked acceptance checklist.

- **Timeline:** projected occurrences for the next seven days, with planned start/end and timezone. Preview is capped at 30 occurrences per schedule / 120 overall; frequent cron jobs can have additional occurrences outside this preview.
- **Board:** enabled/paused schedules and direct edit/pause controls.
- **Table:** next start, recurrence, timezone and number of jobs created from that schedule.

Durations are planning estimates, not reservations or execution deadlines. Overlapping tasks enter the serial queue. Reminders only notify. Past one-time occurrences cannot be re-enabled; create a future schedule. Scheduling runs while a trusted workspace is open and the extension host is active; there is no background daemon when VS Code is closed.

Lịch có ba cách xem **Dòng thời gian / Bảng cột / Bảng dữ liệu**, sửa trực tiếp trong trang. Khung giờ là dự kiến; task trùng giờ chờ trong hàng đợi. Thời lượng không giới hạn thời gian chạy thật. Cron dùng múi giờ đã chọn. Lịch chỉ hoạt động khi VS Code và extension đang chạy. Mỗi lần chạy giữ đội đã lưu trong lịch và checklist nghiệm thu riêng.

## Useful daily quota

Use **Daily quota tasklist** to include/exclude accounts explicitly, then set workspace, timezone, task budget and usage target in the inline form. **Save and start** starts a new bounded budget until the next local midnight; it retains existing task/decision history. Existing unfinished tasks from an earlier day are not silently carried into the new day.

The dispatch preview explains the current blocker or next candidate. Each account row explains whether it is excluded, missing fresh quota, at its usage target, limited/paused or eligible. The lower of the daily target and account ceiling applies. A provider reset timestamp alone is not fresh available quota. The engine requires fresh observations for automatic daily dispatch; it does not infer subscription balances from API usage or generate dummy requests.

Add concrete tasks and choose their accounts inline. Unstarted tasks have up/down priority controls. Important decisions pause the affected task and remain in the decision log. If enabled, independent code review, UI/UX, hotkey, convention and CI/CD review can continue without implementing the blocked decision. Generated repository maintenance uses CLI accounts, because HTTP has no repository tools; HTTP daily tasks need explicit supplied context and read-only mode. At most one generated maintenance task per category/account/day is created. Failed work requires review; when useful work is exhausted, the plan stops. Excluding the primary manager makes final approval wait, rather than silently changing authority.

Một lượt ngân sách là một **task của đội**, có thể gồm nhiều lần gọi mô hình. Kế hoạch chỉ chạy công việc hữu ích theo quota mới quan sát, ngưỡng dùng và ngân sách; không đảm bảo “đốt hết” token. Có thể đổi thứ tự việc chưa chạy, loại account yếu/cần giữ quota, xem lý do chờ và dừng ngay. Quyết định quan trọng vẫn chờ bạn; bảo trì độc lập không được tự thông qua quyết định đó.

## Local, cloud and third-party connections

CLI remains the default and keeps native provider login, filesystem tools, edit permissions and backups. Existing Codex/Claude/Gemini profiles need no migration.

For another provider or local runtime, choose **Accounts & quota → Add account → Third-party / local API**:

1. Choose Local or Cloud. Ollama/LM Studio presets fill the common loopback API base URL; the runtime and model must already be installed/running. Custom endpoints must implement OpenAI-compatible `/models` and/or `/chat/completions`.
2. Save the account. If required, expand **Store profile secret** and store the key under `RELAYCREW_API_KEY`. It is held in VS Code SecretStorage, sent only as a Bearer header, and omitted from board drafts, reports and source archives. CLI login/subscription credentials are not reused for API access.
3. Click **Check connection** to fetch the model catalog without a generation request. With exactly one catalog model, Auto can select it. Otherwise choose Custom and select/type a model ID from the discovered options. An explicit model can be used even when the endpoint has no catalog; then check with a read-only chat. RelayCrew does not pretend to rank third-party models or know their flagship.
4. Click **Read-only chat**, attach selected text/code/Markdown or PNG/JPEG, and send. The HTTP adapter streams public text and supports JSON or SSE responses. It has **no repository/shell/tools**, does not scan/upload the workspace, and rejects editable Dev/Repair turns. Read-only reviews require supplied context and must report missing evidence.

```json
{
  "id": "local-review",
  "label": "Local review",
  "provider": "compatible",
  "transport": "http",
  "hosting": "local",
  "endpoint": "http://localhost:11434/v1",
  "executable": "http",
  "modelPolicy": "flagship"
}
```

The legacy `executable` field is `http` for these profiles; it never runs a binary. Cloud endpoints require HTTPS. Local endpoints use loopback (`localhost`, `127.0.0.1`, `::1`). Endpoint URLs cannot contain embedded credentials, queries or fragments; redirects are rejected. “Local” describes the endpoint, not a guarantee that the server performs inference offline: verify the runtime's selected model, since local servers can proxy cloud models. Automatic compatible-account fallback does not cross hosting location, transport or endpoint. Explicitly configured rotation pools remain an owner choice.

API chỉ dùng ngữ cảnh bạn gửi; chưa có công cụ đọc/sửa repo. Muốn Dev/Repair sửa code thì dùng CLI. Local/Cloud là lựa chọn kết nối rõ ràng; cần kiểm tra máy chủ Local có dùng mô hình đám mây hay không. Khóa API lưu trong SecretStorage, không lấy từ đăng nhập CLI. Quota API còn lại vẫn cần nguồn quan sát riêng; số token của một phản hồi không phải số quota thuê bao còn lại.

Protocol references: [Ollama compatibility](https://docs.ollama.com/api/openai-compatibility), [LM Studio chat completions](https://lmstudio.ai/docs/developer/openai-compat/chat-completions), [Chat Completions reference](https://developers.openai.com/api/reference/resources/chat).

## Chạy liên tục / pause

Hàng đợi tự chạy từng task và từng bước khi không pause. **Tạm dừng ngay** dừng cây tiến trình CLI đang chạy, giữ file và đặt bước hiện tại lại pending. Trạng thái pause được lưu; **Tiếp tục hàng đợi** chạy lại bước dở với chỉ dẫn đọc diff/tránh làm lại thao tác. Cancel là dừng hẳn task, không rollback file.

Pause không phải đóng băng process tại một instruction: tác vụ đang sửa file có thể đã hoàn thành một phần khi nhận tín hiệu dừng. Không thể rollback giao dịch ngoài repo hay đảm bảo một command có side effect không bị lặp khi chạy lại. Các bước hoàn thành không chạy lại; step request/response/attempt vẫn được lưu.

Khi mở lại workspace, task queued an toàn được chạy tiếp nếu không pause. Task được ghi running lúc host mất đột ngột được đánh dấu interrupted để kiểm tra. Backlog đã bật tiếp tục trong cửa sổ thời gian/số lượt còn hiệu lực; không có loop vô hạn mặc định.


## Quota và luân phiên

Bản 0.3 tách `QuotaService`/`QuotaSource` khỏi routing. File quota được đọc theo `aiTeam.quotaRefreshSeconds` (mặc định 30 giây; timer host kiểm tra mỗi 15 giây). Có thể refresh chủ động từ menu account. Snapshot hỗ trợ nhiều `windows`; percentage hiệu lực lấy mức cao nhất để giới hạn tuần không bị che bởi giới hạn ngắn hạn còn trống.

Status bar phản ánh profile thật đang chạy. Click thanh quota để xem account, cập nhật snapshot hoặc switch task. Task đang chạy được pause trước khi đổi; role được pin cho task để round-robin không ghi đè lựa chọn thủ công. Model/reasoning override cũ của role đó được bỏ khi chủ động chọn profile mới. Task đang chờ quota vẫn cần snapshot hợp lệ và Resume; switch không giả định account mới có quota.

- `autoSwitch`: trước bước mới, account hết quota có thể đổi sang profile cùng provider/model/effort, transport, nơi chạy và endpoint khi có snapshot mới đủ capacity.
- `resumeAfterQuota`: task chờ preflight quota được tiếp tục khi có snapshot mới còn capacity. Qua giờ reset không tự coi là đã có quota.
- `resumeProviderLimited`: opt-in riêng cho bước đã thực sự bị CLI báo limit. Cần snapshot available mới hơn thời điểm bị limit đối với account đó; step có thể đã sửa file. Kết hợp `resumeAfterQuota` để tự chạy lại. Tối đa 3 lần CLI báo limit trên cùng step rồi dừng để kiểm tra.
- `routingMode=roundRobin`: chọn luân phiên trong `rotationPools` rõ ràng theo role, bỏ qua account exhausted/unknown/stale. Pool có thể chứa provider/model khác vì đây là lựa chọn chủ động của owner. Model override ở node vẫn áp dụng cho profile được chọn.

```json
{
  "aiTeam.routingMode": "roundRobin",
  "aiTeam.rotationPools": {
    "builder": ["codex-main", "codex-second"],
    "auditor": ["claude-main"],
    "worker": ["gemini-main"],
    "lead": ["codex-main"]
  },
  "aiTeam.resumeAfterQuota": true,
  "aiTeam.resumeProviderLimited": false
}
```

Quota vẫn là manual/file integration, chưa tự đọc subscription của provider. CLI limit được phân loại ở các error envelope nhận biết được; lỗi format lạ dừng task và giữ log để xem, không suy diễn quota.

File quota có thể bổ sung `remainingTokens` và `limitTokens` là số nguyên không âm. Snapshot quá 5 phút/qua reset là stale; không coi missing là 0%.


## Tận dụng quota bằng backlog hữu ích

Thêm task thật bằng **Add Backlog Item**, sau đó bật **Start / Stop Quota Utilization**, đặt 1–20 task và 1–180 phút. Mỗi backlog item chạy một lần. Extension chờ capacity mới cho toàn bộ role đang dùng, dừng dispatch khi hết thời gian/lượt/backlog hoặc item trước cần review. Task đang chạy không bị cắt chỉ vì cửa sổ dispatch hết hạn; dùng Pause/Cancel để dừng ngay.

Không tạo prompt giả để tiêu token. Không thể cam kết dùng hết quota chính xác vì phần quota không được provider cung cấp trực tiếp và kích thước mỗi task khác nhau. Các toggle mặc định tắt trừ backup; owner bật khi muốn.


## Lưu bền và backup

- `state.json`: flow, hàng đợi, lịch, quota snapshots, pause, backlog, input/output và timeline.
- `messaging.json`: cấu hình kênh không có token, inbox/outbox, polling cursor, chat history.
- Các file JSON được ghi temp cùng thư mục rồi atomic rename, fs flush trước rename. Lưu 50 bản trước mỗi thay đổi; nội dung không đổi không sinh backup. Nếu primary JSON hỏng, thử bản backup hợp lệ gần nhất và giữ file hỏng với đuôi `.corrupt-*`.
- Nếu phải phục hồi từ bản cũ, hàng đợi chuyển sang pause, các job queued/running chuyển interrupted và backlog tắt để tránh chạy lại việc có thể đã xong. Messaging recovery không tự gửi lại pending delivery hay thực thi lại command từ bản backup cũ.
- Report Markdown và log đã che các secret do extension truyền vào được giữ riêng. Bot/OA token nằm trong SecretStorage, không ghi vào state/backup JSON.

**Source backup mặc định bật trước mỗi bước Dev/Repair có quyền sửa**:

- Cần Git working directory. Copy các file tracked và untracked không bị ignore; bao gồm thay đổi chưa commit.
- Thêm đường dẫn tương đối vào `aiTeam.backupExtraPaths` nếu cần giữ dữ liệu đang bị ignore (ví dụ file dữ liệu thử nghiệm). Không đọc path thoát workspace hoặc qua symlink ra ngoài.
- Không backup lịch sử `.git`, nội dung submodule, symlink hoặc mặc định các file bị ignore. Manifest ghi rõ file omitted, SHA-256 và đường dẫn gốc. Database đang hoạt động chỉ được copy file, không có cam kết transaction-consistent; cần cơ chế backup riêng của database.
- Default tối đa 100 MB/snapshot, 2 GB tổng source snapshots, 10.000 files. Nếu không backup được hoặc vượt cap, chặn CLI sửa code và báo lỗi. Có thể chỉnh `backupMaxMB`, `backupStorageMB`; source snapshots không tự xóa.
- **Browse Backups** mở manifest và đường dẫn. File nằm dưới `source-backups/<snapshot>/files/`. So sánh với working copy trước khi khôi phục thủ công; extension không tự ghi đè repo để restore.

Workspace storage do VS Code quản lý, không phải backup ngoài máy. Xóa VS Code user data/workspace storage hoặc hỏng ổ đĩa vẫn mất dữ liệu; có thể copy thư mục storage sang nơi backup của bạn khi workspace đóng.

Luồng này tạo checkpoints để quan sát/phục hồi file; có worktree tùy chọn; chưa có merge tự động hoặc backup toàn bộ hệ thống. Tránh chạy hai workspace khác nhau cùng sửa một checkout.

## Bổ sung 0.4: thư mục tác vụ

Trong **Dự án** hoặc **Thiết lập**, bật tạo Git worktree cho task mới. Git 2.31+ cần có trong PATH. Source phải sạch và đã commit; folder/branch được tạo từ HEAD trong extension workspace storage. Task và schedule/backlog/daily được tạo sau khi bật đều chụp mode mới; task cũ giữ nguyên. Mỗi task dùng một checkout cho mọi bước; task khác không tự kế thừa thay đổi chưa merge.

Không tự merge/xóa worktree. Đường dẫn, branch và base commit được lưu, hiển thị trong bảng/timeline. Git worktree metadata vẫn liên kết repo gốc: giữ cả repo gốc lẫn extension storage cho đến khi tích hợp xong. Worktree không nằm trong quota dung lượng source-backup; theo dõi disk và dọn bằng Git sau khi kiểm tra thay đổi. Bản thân worktree không phải bản sao lưu độc lập.

Tùy chọn mở chat Codex tự động chỉ chuẩn bị chat tại folder một lần lúc bắt đầu task. Không tự gửi prompt, không chuyển account desktop, không đồng bộ session CLI và chưa tự tạo nhóm Projects ở sidebar Codex. Nút mở thủ công có thể thử lại. Xem [PROJECTS.md](PROJECTS.md).

## 0.9.1 Markdown starter pack

Open **Setup → Input and response templates → Markdown examples** to reveal the bundled `examples` folder, or use [the source examples](../examples/README.md). Copy/edit a guide, then use the existing role Markdown or workflow importer. Five role guides, four workflows and task/acceptance examples are included. Samples contain no credentials or account/model pins, do not execute automatically and cannot grant permissions.

Mở **Mẫu Markdown** để xem thư mục mẫu, sao chép/chỉnh file rồi nhập cho đúng vai trò hoặc workflow. Mẫu đầu bài có thể đính kèm trong Console; chép các dòng checklist vào ô nghiệm thu để có checkbox.
