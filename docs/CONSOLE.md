# Live console (0.8)

## Chat, team tasks and keyboard

The composer offers **Chat · one account, read-only**, **Team task · Dev → Audit → Manager**, and owner replies. Choose a chat account explicitly. A greeting such as `hello` runs one read-only reply; no audit/manager stages or repository inspection are requested. Team work is explicit through the selector, New task or `/new`/`/task`; `/ask` chooses chat. Chat sessions can include bounded previous conversation context.

**Enter** sends, **Shift+Enter** adds a line, and **Ctrl/Cmd+Enter** also sends. The Send shortcut selector can restore Enter-for-newline behavior with Ctrl+Enter sending. IME composition, held keys and pending submissions do not submit again. Ctrl/Cmd+Enter also submits the active inline configuration form. Copy/paste remains native.

Global shortcuts: Ctrl+Alt+Shift+R opens the board; C opens chat; N opens a team task; P pauses/resumes the queue. On macOS use Cmd instead of Ctrl. Customize these in VS Code Keyboard Shortcuts.

The readable reply appears above expandable **Technical activity**. JSON audit/manager summaries are extracted for reading; raw requests, tool events and responses remain available. Claude partial streaming plus its full assistant snapshot is de-duplicated.

**Tiếng Việt:** Chọn Trò chuyện để một tài khoản trả lời, hoặc Giao việc nhóm để chạy Dev/Audit/Manager. Enter gửi, Shift+Enter xuống dòng; có tùy chọn Ctrl+Enter. Câu chào không còn chạy kiểm định repo. Câu trả lời được tách khỏi nhật ký kỹ thuật có thể mở rộng. Nút Sửa prompt dẫn thẳng tới mẫu theo vai trò; các mẫu này dùng cho giao việc nhóm.

## Agent map (local preview)

**Console + agent map** shows the selected session beside its recorded Dev → Audit → Repair → Manager flow. Each card shows the account, model, current assignment and recorded status. Supporting coordinators appear in a separate branch. Click a card to inspect the exact assignment, public activity, response or failure; owner questions offer **Reply here**. Planned stages remain pending until dispatched.

Choose **Console only** or **Map only**, or press **Alt+M** to toggle Console/split view. Drag the map divider, use its arrow keys, or double-click to reset its size. Selection, size, expanded details, reading position and the composer draft survive live updates. **Follow active agent** clears a pinned selection. Narrow windows stack the panels with independent scrolling. Counts describe recorded stages/accounts, not an estimate of total work or completion time.

**Tiếng Việt:** Chọn **Console + bản đồ agent** để xem phiên và luồng Dev → Kiểm định → Sửa lỗi → Quản lý cạnh nhau. Bấm thẻ để xem tài khoản/model, việc được giao, phản hồi, lỗi và sự kiện công khai; có câu hỏi thì bấm **Trả lời tại đây**. Điều phối viên phụ nằm ở nhánh riêng. Các bước chưa giao vẫn hiện đang chờ. Có chế độ Chỉ Console/Chỉ bản đồ, **Alt+M** chuyển Console/bố cục đôi. Kéo vạch chia để chỉnh kích thước; bấm đúp để đặt lại. Cập nhật trực tiếp giữ bản nháp, thẻ đang chọn và vị trí đọc. **Theo agent đang chạy** bỏ ghim thẻ. Màn hình hẹp xếp hai panel theo chiều dọc và cuộn riêng.

### Move, float and detach panels

**Canvas** lets you drag individual agent cards, pan by dragging the background, zoom, Fit and reset the layout. Alt+arrow keys move a focused card; Escape cancels a drag. Card positions change the view; execution still follows the flow configured in Setup. Select a card to read **Result**, **Input** or **Activity** in the adjacent/below inspector. Incoming output preserves your selection, inspector scroll and geometry; an update arriving during a drag waits until release. **List** provides a simpler view. These controls also work in the detached map.

The composer shows the receiving account/team, draft/submission state, selected-session status and a character count. **Preview delivery** shows the message, owner criteria and attachment names before sending; it does not call a model. The session-status chip opens its result. The Send button stays near the input and is disabled for an empty draft, pending acknowledgement or attachment upload.

The **Activity bell** keeps the latest 100 recorded step/flow completions in local workspace data. Select **Each step and entire flow**, **Entire flow only**, or **History only**. New completions offer **Open result** in VS Code; the last step of a successful flow shares one flow popup. Old completions are imported as read without replaying popups. Completed execution does not check the owner's Definition of Done automatically. Errors, quota warnings and owner decisions retain their separate alerts.

**Tiếng Việt:** Chế độ **Sơ đồ** cho kéo từng thẻ, kéo nền, phóng/thu, **Vừa khung** và đặt lại vị trí. Alt+mũi tên di chuyển thẻ đang focus; Escape hủy kéo. Kéo thẻ chỉ đổi cách nhìn; flow chạy theo Thiết lập. Bấm thẻ để xem **Kết quả / Đầu vào / Hoạt động**; cập nhật giữ vị trí đọc và chờ bạn thả chuột nếu đang kéo. Khung nhập hiển thị người nhận, trạng thái gửi và phiên đang chọn; **Xem trước nội dung gửi** không gọi model. Chuông **Hoạt động** lưu 100 lần hoàn tất gần nhất; tùy chọn báo từng bước + flow, chỉ flow hoặc chỉ lưu lịch sử. **Mở kết quả** dẫn đúng tác vụ/bước; lịch sử cũ được đánh dấu đã đọc và không bật lại thông báo. Hoàn tất chạy không tự đánh dấu checklist nghiệm thu của chủ sở hữu.

Drag the **⠿ title grip** on the map or composer to move it. Dropping near a workspace edge docks it there; the highlighted area previews the target. Release away from an edge to leave it floating. **Float** also opens an in-app floating panel immediately. Resize from its bottom-right corner. Press **Escape** during a drag to restore the previous position. When the floating title grip has focus, arrow keys move it; Shift increases the distance. The **⋯** menu offers left/right/top/bottom docking and Hide. Restore hidden panels with the Console view/composer controls; Reset layout returns both panels to their defaults. Layout export/import includes docking positions. Floating geometry is saved locally and clamped to the current window.

The map's **↗** button opens a separate VS Code editor tab with live updates, session selection and owner-reply/stop controls. Drag that tab into another editor group, or choose **Move to new window** for a VS Code auxiliary window where supported. **Follow Console session** links the map to the board; selecting a different session pins the detached map independently. **Return to board** closes only the detached view. Opening or moving a view does not start another agent or runner.

**Tiếng Việt:** Kéo nút **⠿ tiêu đề** của bản đồ hoặc khung nhập; thả sát mép để ghim, vùng sáng cho biết vị trí sẽ ghim. Thả ở giữa để giữ khung nổi. Nút **Tách nổi** mở ngay panel nổi trong giao diện; kéo góc dưới bên phải để đổi kích thước. **Escape** hủy lần kéo, phím mũi tên di chuyển khi focus vào tiêu đề khung nổi. Menu **⋯** chọn ghim trái/phải/trên/dưới hoặc ẩn. Vị trí và kích thước lưu riêng theo workspace, giữ bản nháp khi cập nhật. **↗** mở bản đồ ở tab VS Code riêng; kéo tab để chia editor hoặc chọn **Chuyển sang cửa sổ mới**. Bật **Theo phiên Console đang chọn** để liên kết hai màn hình; chọn phiên khác sẽ ghim riêng. **Về bảng chính** chỉ đóng bản đồ tách riêng, không dừng agent.

## Voice toolbar

The horizontal voice toolbar has a microphone button, the system dictation shortcut and a settings button. Voice settings expand inline. Browser speech requires explicit opt-in; if unavailable, focus the prompt and use Windows **Win+H** or your desktop's dictation shortcut. Review the transcript before sending. Escape, switching tabs, losing window focus and submitting stop recording; late recognition results cannot change the draft after stopping. RelayCrew does not store audio.

**Tiếng Việt:** Thanh giọng nói nằm ngang gồm nút mic, phím tắt hệ thống và nút cài đặt. Cài đặt mở ngay bên dưới; dịch vụ giọng nói trình duyệt chỉ chạy khi bạn bật cho phép. Nếu không hỗ trợ, chọn ô nhập rồi dùng **Win+H** trên Windows. Kiểm tra bản chép lời trước khi gửi. Escape, đổi tab, mất focus hoặc gửi sẽ dừng thu; kết quả đến muộn sau khi dừng không ghi vào bản nháp. RelayCrew không lưu âm thanh.

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

## 0.9: public conversation and acceptance

Team conversation now stays visible in the live session, separate from expandable technical events. Public JSON audit/manager results become readable sections; exact messages remain available. Team task submissions can include a Definition of Done, one criterion per line. Task cards show phase progress separately from owner acceptance and expose saved context and flow. See the bilingual [operations guide](OPERATIONS.md).

Hội thoại công khai hiện trực tiếp trong phiên; JSON Audit/Manager được trình bày dễ đọc. Task đội có checklist nghiệm thu riêng, lưu cùng task và đưa vào prompt. Nhiều task có thể xếp hàng; engine hiện chạy lần lượt. Không hiển thị suy luận riêng tư hoặc tự đoán phần trăm code/giờ hoàn tất.


## Panel window controls / Điều khiển panel

Each Composer and Agent map header has **− Minimize**, **× Close**, float and placement controls. Minimize returns the view to the panel bar; Close hides it with an **Open panel** shortcut in the same bar. Restore keeps the draft, selection, docking and floating size/position. Both actions affect the view only; agents continue running. Use **Stop task** or **Pause immediately** to control execution. Restore buttons support Tab and Enter; Alt+I focuses the composer and Alt+E toggles it.

Mỗi panel **Khung nhập** và **Bản đồ agent** có nút **− Thu nhỏ**, **× Đóng**, tách nổi và chọn vị trí. Thanh panel hiện nút **Khôi phục/Mở panel** khi bị ẩn. Nội dung đang gõ, phiên đã chọn, vị trí ghép và kích thước panel nổi được giữ lại khi mở lại hoặc tải lại. Agent vẫn chạy; dùng **Dừng tác vụ** hoặc **Tạm dừng ngay** để điều khiển thực thi. Có thể dùng Tab rồi Enter để mở lại, Alt+I để vào khung nhập, Alt+E để đóng/mở khung nhập.


## Edit the team from the map / Chỉnh đội ngay trên bản đồ

The map has **Observe task** and **Edit team** modes. Click a role card to change its account, optional model/reasoning override, or open its name/instructions editor. Add or remove the optional Repair stage and up to four supporting coordinators. Dev, Audit and Manager remain required by the current engine. One account may cover several roles; supporting coordinators must differ from the primary manager. Save applies the validated team to future tasks only. Discard restores the latest saved configuration, and unsaved edits survive refresh/reload. Existing job assignments, responses and prompts remain recorded as they ran. The detached map's **Edit team** action opens this editor on the board.

Bản đồ có **Theo dõi tác vụ** và **Chỉnh đội**. Bấm thẻ vai trò để đổi tài khoản, ghi đè model/mức suy luận nếu cần, hoặc mở trình đổi tên/hướng dẫn. Có thể thêm/bỏ bước Sửa lỗi và tối đa bốn coordinator. Engine hiện yêu cầu ba bước Dev, Audit và Manager. Một tài khoản được làm nhiều vai trò; coordinator phải khác tài khoản quản lý chính. Bấm **Lưu luồng đội** để áp dụng cho tác vụ mới, hoặc **Bỏ thay đổi** để trở về cấu hình đã lưu. Nháp được giữ qua cập nhật và tải lại. Phiên đang chạy giữ nguyên dữ liệu lịch sử. Bản đồ tách tab có nút mở trình chỉnh đội trong bảng chính.

The observer adds agent selection chips, consistent state dots and a single sticky inspector header. Select a chip to bring that agent into view, then inspect Result, Input or Activity. Dragging cards only changes the visual arrangement; editing the actual flow is explicit in Edit team.


## Observer views, public exchanges and compact chrome

Choose **Canvas**, **List**, **Table** or **Dependencies**. Table and Dependencies include local role/account/model/work search and status filters, saved per session. Dependency edges represent the recorded execution order and coordinator reports; they are not inferred parallel work. Public exchange rows use recorded assignment, response, tool and stream events, with links into exact Input/Result/Activity. The movement indicator is limited to recent public events during a running task. Completed flows explicitly say no agent process is running. Card selection means viewing details; it does not mark the agent as running. Runtime model, reasoning and CLI/API mode are displayed separately.

Choose **Compact header** (Alt+H) to reclaim the top area, or **Customize header** to toggle the brand, page tabs and monitor controls separately. The compact bar retains page navigation and an Expand action. Layout preferences persist in the workspace.

**Edit team → Start from a template** offers Fast delivery, Repair loop, Independent review, One account team and Local audit. Templates change the draft only. Review account/model choices, rename roles or attach Markdown instructions through the prompt editor, then save. Local audit requires an existing local HTTP profile; it does not install a model or create an account.

Chọn **Canvas / Danh sách / Bảng / Phụ thuộc** để theo dõi theo cách dễ đọc nhất. Bảng và Phụ thuộc có tìm kiếm và lọc trạng thái, giữ lại theo phiên. Đường phụ thuộc biểu diễn thứ tự thực thi đã ghi nhận, không tự suy diễn chạy song song. Trao đổi chỉ lấy từ sự kiện CLI công khai và có nút xem yêu cầu/kết quả/hoạt động cụ thể. Luồng xong ghi rõ không có tiến trình agent đang chạy. Thẻ được chọn xem được phân biệt với agent đang thực hiện. Model, mức suy luận và chế độ CLI/API được hiển thị rõ.

Bấm **Thu gọn phía trên** (Alt+H), hoặc **Tùy chỉnh thanh trên** để bật/tắt từng phần. Thanh gọn vẫn có chuyển trang và nút mở rộng. Các mẫu thiết lập chỉ sửa nháp; cần kiểm tra rồi lưu. Mẫu Audit local yêu cầu profile HTTP local đã có sẵn.
