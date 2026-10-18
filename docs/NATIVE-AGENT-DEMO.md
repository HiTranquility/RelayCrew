# Watching a real agent team / Quan sát đội agent thật

RelayCrew 1.0.1 adds **Run with 3 native subagents** under Agent map → Edit team → read-only demos. Choose a Codex dispatcher. Codex opens three native children, Claude plans three bounded checks, the configured executor runs those checks, and the manager reviews their evidence. This spends the selected accounts' normal quota. The dispatcher and children stay read-only. Older release artifacts remain unchanged.

RelayCrew 1.0.1 có nút **Chạy với 3 agent con thật** trong Agent map → Chỉnh team → demo chỉ đọc. Chọn Codex điều phối. Codex mở ba agent con, Claude lập ba kiểm tra, tài khoản executor thực hiện, manager tổng hợp bằng chứng. Có dùng quota thật; dispatcher và agent con chỉ đọc. Giữ nguyên các gói phát hành cũ.

Children appear only after a public CLI collaboration event identifies them. Their exact assignments and returned evidence are inspectable in the map and Live session. An unreported final status stays unknown. The observer does not expose private reasoning, native child tools that the CLI does not stream, or an invented model ID.

Agent con chỉ xuất hiện khi CLI báo sự kiện tạo thật. Có thể xem đề bài và bằng chứng trong sơ đồ hoặc Live session. Chưa báo trạng thái cuối thì giao diện ghi rõ; không suy diễn đã hoàn tất hoặc bịa model. Chỉ hiển thị dữ liệu cộng tác công khai mà CLI cung cấp.

| Action / Thao tác | Control / Điều khiển |
| --- | --- |
| Expand any view / Phóng lớn chế độ đang xem | M or ⛶; Esc to return / Esc trở lại |
| Agent details popup / Popup chi tiết agent | Double-click card or table/dependency row; Enter on selection / Bấm đúp ô hoặc dòng; Enter trên lựa chọn |
| Expand canvas / Phóng lớn canvas | Double-click background / Bấm đúp nền |
| Zoom / Thu phóng | + / −; Ctrl + wheel / cuộn; up to / tối đa 300% |
| Fit all / Vừa khung | 0 |
| Actual size / Kích thước thật | 1 or 100% |
| Pan / Di chuyển khung nhìn | Drag background or arrows; Shift for larger steps / Kéo nền hoặc mũi tên; Shift để di chuyển nhanh |
| Select previous/next / Agent trước/sau | [ / ] |
| Find active / Tìm agent đang chạy | F |
| Reposition a card / Dời ô agent | Drag card or Alt + arrows / Kéo ô hoặc Alt + mũi tên |

Shortcuts apply while the map is focused and do not intercept text fields. Dependencies groups actual children under their recorded parent; native siblings do not depend on one another. Executor checks remain sequential. Close observer panels freely; use **Stop task** to stop the run.

Phím tắt áp dụng khi đang thao tác sơ đồ, không chặn ô nhập. Dependencies nhóm agent con theo cha được CLI ghi nhận, không nối nhầm các nhánh song song thành chuỗi. Các kiểm tra executor vẫn chạy lần lượt. Đóng panel chỉ ẩn màn hình; dùng **Dừng tác vụ** để dừng chạy.
