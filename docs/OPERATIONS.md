# Điều phối, quan sát và dữ liệu

## UI

**Setup Team Flow** là sơ đồ gọn: 3 node Dev → Audit → Lead, hoặc 4 node thêm Repair trước Lead. Mỗi node chọn CLI/account profile và override model/reasoning. Trống dùng cấu hình profile; Gemini không nhận reasoning flag. Task và schedule chụp lại flow/overrides riêng, không bị đổi khi sửa flow cho task mới. Chưa có graph tùy ý, branch/loop hoặc kéo thả kiểu n8n đầy đủ.

**Assignment Board** cho thấy:

- Task, phân công theo role, profile ID, model/reasoning thực dùng, trạng thái và tóm tắt audit/lead.
- Quota phần trăm, token còn/tổng nếu nguồn cung cấp, nguồn dữ liệu và reset. Thiếu dữ liệu ghi unknown, không tính số token từ phần trăm.
- Input gửi từng agent, phản hồi và timeline ai gửi cho ai. CLI được đọc dưới dạng sự kiện JSON công khai; không hiển thị chain of thought riêng tư. Không phải mọi provider đều streaming từng token; một số sự kiện chỉ xuất hiện khi provider hoàn thành message.
- Thời gian đã chạy, mốc timeout. Không có ETA giả; provider chưa có tiến độ nên ghi chưa xác định.
- Click profile để biết account label đã cấu hình. Email/danh tính tài khoản đăng nhập chưa tự xác minh; đặt label rõ lúc cấu hình.
- Hội thoại hai chiều Telegram/Zalo và các nút Reply, Cancel, Resume, Backup, Setup.

## Chạy liên tục / pause

Hàng đợi tự chạy từng task và từng bước khi không pause. **Tạm dừng ngay** dừng cây tiến trình CLI đang chạy, giữ file và đặt bước hiện tại lại pending. Trạng thái pause được lưu; **Tiếp tục hàng đợi** chạy lại bước dở với chỉ dẫn đọc diff/tránh làm lại thao tác. Cancel là dừng hẳn task, không rollback file.

Pause không phải đóng băng process tại một instruction: tác vụ đang sửa file có thể đã hoàn thành một phần khi nhận tín hiệu dừng. Không thể rollback giao dịch ngoài repo hay đảm bảo một command có side effect không bị lặp khi chạy lại. Các bước hoàn thành không chạy lại; step request/response/attempt vẫn được lưu.

Khi mở lại workspace, task queued an toàn được chạy tiếp nếu không pause. Task được ghi running lúc host mất đột ngột được đánh dấu interrupted để kiểm tra. Backlog đã bật tiếp tục trong cửa sổ thời gian/số lượt còn hiệu lực; không có loop vô hạn mặc định.

## Quota và luân phiên

Bản 0.3 tách `QuotaService`/`QuotaSource` khỏi routing. File quota được đọc theo `aiTeam.quotaRefreshSeconds` (mặc định 30 giây; timer host kiểm tra mỗi 15 giây). Có thể refresh chủ động từ menu account. Snapshot hỗ trợ nhiều `windows`; percentage hiệu lực lấy mức cao nhất để giới hạn tuần không bị che bởi giới hạn ngắn hạn còn trống.

Status bar phản ánh profile thật đang chạy. Click thanh quota để xem account, cập nhật snapshot hoặc switch task. Task đang chạy được pause trước khi đổi; role được pin cho task để round-robin không ghi đè lựa chọn thủ công. Model/reasoning override cũ của role đó được bỏ khi chủ động chọn profile mới. Task đang chờ quota vẫn cần snapshot hợp lệ và Resume; switch không giả định account mới có quota.

- `autoSwitch`: trước bước mới, account hết quota có thể đổi sang profile cùng provider/model/effort khi có snapshot mới đủ capacity.
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

Luồng này tạo checkpoints để quan sát/phục hồi file; chưa có worktree isolation, merge tự động hoặc backup toàn bộ hệ thống. Tránh chạy hai workspace khác nhau cùng sửa một checkout.
