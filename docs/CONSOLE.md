# Live console (0.8)

## Chat, team tasks and keyboard

The composer offers **Chat · one account, read-only**, **Team task · Dev → Audit → Manager**, and owner replies. Choose a chat account explicitly. A greeting such as `hello` runs one read-only reply; no audit/manager stages or repository inspection are requested. Team work is explicit through the selector, New task or `/new`/`/task`; `/ask` chooses chat. Chat sessions can include bounded previous conversation context.

**Enter** sends, **Shift+Enter** adds a line, and **Ctrl/Cmd+Enter** also sends. The Send shortcut selector can restore Enter-for-newline behavior with Ctrl+Enter sending. IME composition, held keys and pending submissions do not submit again. Ctrl/Cmd+Enter also submits the active inline configuration form. Copy/paste remains native.

Global shortcuts: Ctrl+Alt+Shift+R opens the board; C opens chat; N opens a team task; P pauses/resumes the queue. On macOS use Cmd instead of Ctrl. Customize these in VS Code Keyboard Shortcuts.

The readable reply appears above expandable **Technical activity**. JSON audit/manager summaries are extracted for reading; raw requests, tool events and responses remain available. Claude partial streaming plus its full assistant snapshot is de-duplicated.

**Tiếng Việt:** Chọn Trò chuyện để một tài khoản trả lời, hoặc Giao việc nhóm để chạy Dev/Audit/Manager. Enter gửi, Shift+Enter xuống dòng; có tùy chọn Ctrl+Enter. Câu chào không còn chạy kiểm định repo. Câu trả lời được tách khỏi nhật ký kỹ thuật có thể mở rộng. Nút Sửa prompt dẫn thẳng tới mẫu theo vai trò; các mẫu này dùng cho giao việc nhóm.

## Files, images and clipboard

Choose **Attach files**, drop files into the composer, or paste a clipboard image with **Ctrl+V** (Cmd+V on macOS). Text copy/paste and selection with Ctrl+C remain native; Ctrl+C does not cancel a task. Add a short request and press Ctrl+Enter to send. Attachments work for new tasks and owner replies. Preview image thumbnails and remove chips before sending. Selecting, pasting or dropping a file only stages a local snapshot; it does not invoke a provider.

Limits: up to **8 files / 16 MB per task**, including later owner replies; **PNG/JPEG up to 4 MB each**, or **UTF-8 text/code up to 256 KB each**. PDF, archives, other image formats and binary documents are rejected. No conversion or OCR is implied. Failed submissions retain the draft and file IDs; retries use the existing submission ID. Provider image/model support still depends on the installed CLI and authenticated account.

Snapshots and hashes persist in the workspace's extension storage `attachments/`, outside the repository and retained across reloads. Removing a chip detaches it from the draft; it does not delete the cached snapshot. The cache is capped at **256 MB** and is not automatically pruned. **Backups / saved data** lists its location. Include the entire attachments folder along with state/backups in manual backups; deleting snapshots referenced by tasks prevents those tasks from continuing. Reports include the manifest/hash, not binary bytes. The webview saves only metadata, not base64 image data. Every step receives the task's selected attachments; role handoffs preserve them. Changed or missing snapshots block execution.

Text files are passed as JSON evidence on stdin. Codex images use its [native image flag](https://learn.chatgpt.com/docs/developer-commands?surface=cli). Claude receives selected temporary image paths and a scoped `--add-dir`, following its documented [image-path workflow](https://code.claude.com/docs/en/common-workflows#work-with-images). Gemini receives paths and `--include-directories` for its [image-capable read_file tool](https://geminicli.com/docs/tools/file-system/). Claude/Gemini are instructed to read each image and ask the owner if access/vision is unavailable; their image consumption requires the agent's tool call, rather than eager multimodal injection. The temporary directory contains only this run's images/output and is removed when execution ends. No bypass-permission flag is added.

**Copy last answer** copies the last recorded final step response (which may be the manager's JSON). **Copy report** copies the complete textual report. Streaming partial output can be selected and copied normally. [Connect a real account and configure workflow](QUICKSTART.md).

### Đính kèm và clipboard

Bấm **Đính kèm file**, kéo thả vào ô soạn hoặc **Ctrl+V** để dán ảnh. Ctrl+C/V cho văn bản vẫn hoạt động bình thường. Viết yêu cầu rồi Ctrl+Enter để gửi; chọn file chưa gửi cho model. Dùng được cả khi giao việc mới và trả lời agent. Hỗ trợ tối đa 8 file/tổng 16 MB cho mỗi tác vụ: PNG/JPEG tối đa 4 MB/ảnh, file văn bản/mã UTF-8 tối đa 256 KB/file. Chưa hỗ trợ PDF/ZIP hoặc định dạng nhị phân khác.

Bản chụp lưu ngoài repo trong dữ liệu workspace của extension, giới hạn cache 256 MB. Bỏ chip chỉ bỏ khỏi bản nháp; bản chụp vẫn được giữ. Sao lưu cả thư mục attachments cùng state. Mọi vai trò nhận cùng file; file mất hoặc bị sửa sẽ chặn chạy. Codex nhận ảnh qua cờ native; Claude/Gemini đọc ảnh qua công cụ CLI, phụ thuộc model/quyền hiện tại. Nút **Sao chép câu trả lời cuối** và **Sao chép báo cáo** ghi nội dung vào clipboard khi bạn bấm.

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
