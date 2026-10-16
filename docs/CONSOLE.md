# Live console (0.5)

The board opens on **Live console**. **New task** focuses the inline composer instead of opening a single-line input dialog. Choose a workspace, describe a result and acceptance criteria, and press **Ctrl+Enter**. Enter adds a new line. New tasks use the configured flow, accounts, models and edit permissions.

Select a session to see public CLI output, assignments and responses. Its header shows the actual running profile/model, elapsed seconds and working folder. Follow output tracks new events; scrolling up pauses following. Turn it back on to return to the latest output. The event window is bounded; reports keep full step requests/responses. This view consumes the existing CLI adapter's public events. It is not an interactive shell and does not expose private model reasoning.

When an agent asks a question, click **Reply here** or select **Reply to selected agent**. Replies are scoped to that session and question version. A changed question requires reviewing it again. Queue/daily-plan pauses still apply after a reply. Drafts, selected session, search/filter and follow preference survive refreshes. Streaming patches the transcript without replacing the composer.

| Input | Behavior |
|---|---|
| Plain multiline text or `/new <text>` | Queue a task in the selected workspace |
| `/reply <text>` | Answer the selected session's current owner question |
| `/pause` / `/resume` | Set the workspace queue pause state explicitly |
| `/stop` | Cancel the selected active task, preserving edits |
| `/status` | Show the queue's current pause state |

Unknown slash commands are rejected. Prefix a request beginning with a slash with `/new`. Submissions have persisted IDs so retrying does not create a second task or deliver an owner reply twice. The Send button waits for acknowledgement; an error preserves the draft. One task runs at a time, including when several sessions are visible.

**Overview** adds configured role/account cards, observed quota meters, work in focus and recent handoffs. Profile configuration does not verify authentication. **Tasks** adds search, status filters and recorded-step rails. The known step count can expand after an audit; it is not a percentage estimate of total work.

## Tiếng Việt

Bảng mặc định là **Console trực tiếp**: danh sách phiên bên trái, sự kiện CLI ở giữa và khung nhập nhiều dòng bên dưới. Ctrl+Enter gửi, Enter xuống dòng. Chọn workspace rồi giao việc; task dùng flow/account/model và quyền sửa đã cấu hình.

Chọn phiên để xem profile/model thực, thư mục, thời gian đã chạy và agent chuyển việc cho nhau. Cuộn lên tắt tự theo dõi; bật **Theo dõi đầu ra** để bám dòng mới. Luồng cập nhật không tải lại composer và không làm mất nội dung đang gõ. Đây là sự kiện CLI công khai, không phải terminal tương tác hay suy luận riêng tư.

Agent cần quyết định sẽ hiện câu hỏi và nút **Trả lời tại đây**. Câu trả lời gắn với đúng phiên và số lần trả lời hiện tại; nếu câu hỏi đã đổi thì cần xem lại. Pause hàng đợi/kế hoạch vẫn có hiệu lực sau khi trả lời.

Các lệnh: `/new nội dung`, `/reply nội dung`, `/pause`, `/resume`, `/stop`, `/status`. Lệnh không hỗ trợ sẽ báo lỗi. Retry dùng cùng ID để tránh tạo việc/trả lời trùng. Báo cáo chứa đầy đủ request/response; console chỉ giữ cửa sổ sự kiện gần nhất có giới hạn dung lượng. Mỗi workspace vẫn chạy tuần tự.

Tab **Tổng quan** có thẻ vai trò/account, quota đã quan sát, việc cần xử lý và trao đổi gần nhất. Tab **Tác vụ** có tìm kiếm, bộ lọc và các bước được ghi nhận, không bịa phần trăm tiến độ hoặc ETA.
