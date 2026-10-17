# Hướng dẫn dùng RelayCrew

[English](INSTRUCTIONS.md) · [Tổng quan](README.vi.md)

Hướng dẫn cho RelayCrew 1.0. Gói cũ có thể chưa có đủ các nút bên dưới.

## 1. Kết nối tài khoản

Vào **Tài khoản & hạn mức**, thêm hoặc sửa profile rồi dùng **Cài CLI**, **Đăng nhập**, **Kiểm tra kết nối** khi cần. Extension kiểm tra CLI đã có trên máy và hỏi trước khi cài. Bạn tự hoàn tất đăng nhập ở terminal/trình duyệt. Kết nối thành công chưa đồng nghĩa tài khoản dùng được mọi model.

Nhập khóa ở phần secret của extension; đừng bỏ vào prompt, file Markdown hoặc settings đem lên Git. Cloud/local là nơi model chạy; CLI/HTTP là cách kết nối. Review qua HTTP cần bạn cung cấp ngữ cảnh và không có công cụ đọc repo.

## 2. Chọn việc và thiết lập đội

Dùng **Trò chuyện** khi chỉ cần hỏi một tài khoản; dùng **Nhiệm vụ nhóm** khi cần điều phối. Ghi rõ project, phạm vi, quyền thao tác và tiêu chí hoàn thành.

Vào **Console trực tiếp → Bản đồ agent → Chỉnh đội**. Chọn mẫu rồi bấm từng card để đổi tài khoản. Một tài khoản có thể làm nhiều vai trò. Tên tài khoản và tên vai trò chỉnh riêng. **Tài khoản ưu tiên** dùng cho mẫu mới cùng nhà cung cấp, không đổi phân công đang có.

| Luồng | Cách chạy |
|---|---|
| Phát triển | Dev triển khai → Audit kiểm tra → Repair sửa các việc được giao nếu bật → Manager duyệt |
| Lập kế hoạch rồi thực hiện | Dispatcher giao đề bài → Planner chia việc → Executor thực hiện từng phần → Manager xem bằng chứng |

Mẫu **Codex → Claude → Antigravity** đặt Codex giao việc và quản lý cuối, Claude lập kế hoạch, Antigravity thực hiện. Cần tạo sẵn ba profile; bạn có thể đổi tài khoản sau khi chọn mẫu.

Bấm **Đổi tên / hướng dẫn** để sửa tên vai trò, prompt đầu vào/đầu ra hoặc đính kèm `.md`, rồi lưu mẫu. **Lưu luồng đội** áp dụng cho việc mới. Task đã tạo giữ bản chụp cấu hình; sửa card không thay lịch sử đang quan sát.

Trong **Auditor và quyết định của quản lý**, thêm tối đa bốn auditor phụ và đặt tên như Audit 2, Manager 2. Các auditor dùng chung trần worker. **Thêm quản lý** thêm một tài khoản quản lý; bật **Người ra quyết định** cho những người có phiếu biểu quyết. Quản lý phụ không bật mục này chỉ tư vấn. Manager 1 là người chủ trì.

Chọn **Tất cả đồng ý**, **Đa số** (hòa phiếu hỏi bạn), hoặc **Người chủ trì quyết định sau review**. **Hỏi trước khi chạy** dừng trước lần gọi model đầu tiên; bạn có thể lưu chính sách cho các task sau cùng đội. Khi không đạt điều kiện thông qua, luồng dừng để bạn xử lý và giữ từng ý kiến, không tự tranh luận vô hạn.

Để làm nhiều project, mở **Nhiều folder · nhiệm vụ nhóm** trong ô nhập. Bấm **Chọn thêm folder**, đánh dấu 1–20 thư mục rồi chọn chỉ đọc hoặc quyền sửa của đội cho từng folder. Một lần gửi tạo nhóm các luồng riêng theo folder, chạy lần lượt. Nhóm hiển thị số folder hoàn tất và mở được từng phiên. Phụ thuộc chéo folder cần bạn phối hợp; đây chưa phải một thay đổi đồng bộ trên tất cả repo. **Dừng nhóm việc** dừng cả thành viên đang chạy và đang chờ, giữ lại file đã sửa.

## 3. Chọn model

| Lựa chọn | Ý nghĩa |
|---|---|
| Theo profile | Dùng chính sách model của tài khoản |
| Tự động đề xuất | Tra model mặc định/đề xuất hiện tại hoặc alias của nhà cung cấp khi bắt đầu mỗi bước |
| Mặc định CLI | Để CLI tự chọn |
| Model / alias tùy chọn | Dán ID hoặc alias được tài khoản hỗ trợ để cố định vai trò |

**Làm mới model** lấy danh sách khi kết nối hỗ trợ (Codex và HTTP tương thích). Khi đang mở trình chỉnh đội, danh sách cũ được kiểm tra định kỳ. CLI khác dùng lựa chọn gốc. Nút này không cập nhật CLI, bảo đảm quyền dùng model hay đổi model đang chạy. Chuyển lại tự động sẽ bỏ model đã ghim. Mức suy luận chọn riêng theo khả năng nhà cung cấp.

## 4. Giới hạn chia việc

Trong **Luồng và giới hạn worker**:

- **Planner quyết định trong khoảng:** đặt tối thiểu và tối đa số nhiệm vụ worker.
- **Số worker cố định:** đặt đúng một số; mức tối thiểu tự đi theo số đó.

Worker hiện chạy **lần lượt, một cấp**. Đây là số nhiệm vụ do RelayCrew điều phối, không phải số tài khoản chạy song song hay agent con đệ quy bên trong CLI. Coordinator tính riêng. Trần nhiệm vụ con toàn cục vẫn áp dụng; kế hoạch vượt khoảng sẽ dừng trước khi chạy worker. Nếu không có đủ việc hữu ích, planner cần hỏi bạn.

Ví dụ **1–2** cho phép planner giao một hoặc hai kiểm tra có ích. Một lượt thành công dùng ba lần gọi chính (giao việc/dev, kế hoạch/audit, manager), cộng worker, auditor phụ và các quản lý khác. Mỗi folder được chọn có số lượt riêng. Thử lại hoặc hỏi người dùng có thể phát sinh thêm lượt trong các giới hạn hiện có. Trần quota của tài khoản cấu hình riêng; số token có thể thiếu hoặc chỉ là ước lượng.

## 5. Giả lập rồi chạy demo thật

Mở **Chỉnh đội → Giả lập hoặc chạy demo chỉ đọc**. Nhập việc nhỏ, ví dụ:

> Đọc các điểm vào của project. Chia 1–2 kiểm tra chỉ đọc, báo cáo file và bằng chứng. Không sửa file, chạy test hay đăng tải.

**Giả lập luồng** tạo phiên có nhãn minh họa: không gọi model, đọc code, tốn token hoặc nghiệm thu thật.

**Chạy demo chỉ đọc** gọi CLI thật bằng đội đang chỉnh, không lưu đè đội mặc định. Demo dùng thư mục đầu tiên của workspace và tuân theo quota/giới hạn thông thường. Kiểm tra model chọn cho từng tài khoản dùng được trước khi chạy. Mọi vai trò trong demo đều chỉ đọc.

Qua **Quan sát task** để theo dõi. Sơ đồ, danh sách, bảng và phụ thuộc cùng hiển thị dữ liệu thực đã ghi. Bấm agent hoặc lần bàn giao để xem prompt, trả lời và sự kiện CLI công khai. RelayCrew chuyển báo cáo giữa các bước; mũi tên không có nghĩa các CLI tự kết nối trực tiếp. Không hiển thị suy nghĩ riêng tư của model.

Kéo thanh tiêu đề các panel trong Console để sắp xếp. Mở **Phiên trực tiếp** hoặc **Bản đồ agent** thành tab VS Code riêng, kéo tab sang nhóm editor khác hoặc bấm **Chuyển sang cửa sổ mới**. Các cửa sổ cùng quan sát một task; đóng chúng không dừng hoặc chạy nhân đôi. Tắt **Theo dõi đầu ra** để đọc trao đổi cũ mà không bị cuộn xuống.

**File đã thay đổi** liệt kê thay đổi Git quan sát trong lúc CLI chạy và mở được panel riêng. Những chỉnh sửa cũ không đổi trong phiên được loại khỏi danh sách. File bạn tự sửa đồng thời vẫn có thể xuất hiện: đây là theo dõi thay đổi, không khẳng định agent tạo ra file hay test đã đạt. File Git bỏ qua không được ghi nhận; folder không có Git sẽ báo không theo dõi được.

## 6. Dừng, trả lời và tiếp tục

Dùng nút tạm dừng để chặn bước tiếp theo hoặc dừng tiến trình đang chạy. Khi gặp quyết định quan trọng về sản phẩm, kiến trúc, bảo mật hoặc triển khai, agent hỏi và chờ bạn trả lời. Trả lời sẽ tiếp tục bước đó. Manager duyệt không tự đánh dấu checklist nghiệm thu của bạn; giả lập không tạo phê duyệt thật.

Có thể chỉnh thông báo hoàn thành trong Settings. Đóng/thu nhỏ panel chỉ đổi giao diện; muốn dừng công việc phải dùng nút điều khiển task.

## 7. Dùng lại hướng dẫn Markdown

Chép file từ [bộ mẫu](examples/README.md), sửa rồi vào **Thiết lập → Luồng từ Markdown → Xem trước → Áp dụng**. Markdown thường cung cấp ngữ cảnh. Block JSON `relaycrew` còn có thể đổi phân công và giới hạn; xem trước kỹ. Hướng dẫn riêng từng vai trò nhập ở trình sửa vai trò.

[Mẫu lập kế hoạch và thực hiện](examples/workflows/plan-execute.md) dùng ID tài khoản ví dụ: thay bằng ID đã có trước khi nhập. File hướng dẫn không cấp thêm quyền, cho đăng tải hay mở thêm agent. Giữ quy tắc riêng trong project của bạn và giữ các trường phản hồi cần thiết cho planner/manager để RelayCrew điều phối được.

Lịch chạy, backlog, nhắn tin và sao lưu: xem [Vận hành](docs/OPERATIONS.md) và [Workbench](docs/WORKBENCH-09.md).

## 8. Chọn phương hướng và theo dõi hạn mức

Thanh **Hạn mức sử dụng** thường trực cho biết tài khoản đang xem, mức dùng quan sát được và trần. **Tất cả tài khoản** có nguồn, thời điểm đo, cửa sổ reset và thông báo giới hạn từ nhà cung cấp. Làm mới đọc nguồn quota đã cấu hình; không tự đoán số token của nhà cung cấp. Chọn task và tài khoản rồi **Đổi tài khoản** để xem lại vai trò chưa hoàn tất trước khi áp dụng. Task đang chạy sẽ tạm dừng trước; giữ nguyên lịch sử đã xong.

Trong **Nhiệm vụ nhóm → Phương hướng A / B / C**, viết tóm tắt và chọn tài khoản để **Nhờ AI gợi ý hướng**. Đây là một lượt gọi model thật, chỉ đọc, có dùng quota. Có thể mở phiên đề xuất để xem lỗi hoặc lý do chờ. Sửa phạm vi, kế hoạch code, cấu trúc file dự kiến, tiêu chí hoàn thành và rủi ro rồi chọn một hướng. Nhãn hướng đã chọn hiện trên ô nhập. Gửi task sẽ lưu bản chụp hướng và thêm tiêu chí vào checklist. Gợi ý không tự chạy triển khai; gợi ý mới giữ nguyên các phương án đang sửa đến khi bạn chọn thay thế.

## 9. Rẽ nhánh phiên và tận dụng quota

Mở **Các nhánh phiên → Rẽ nhánh task / chat** để tạo phiên riêng ở folder đã chọn. Chọn loại phiên và quyền. Phiên mới chép bản tóm tắt công khai có giới hạn từ phiên cha, dùng đội/tài khoản chat hiện tại. Quyết định ở phiên cha vẫn chờ. Nhánh thủ công tối đa ba cấp và tám phiên con mỗi phiên.

AI có thể đề xuất tối đa ba việc tiếp nối độc lập cho một hướng. **Tự tạo phiên tiếp nối** mặc định tắt. Đặt trần, sửa từng việc và folder rồi gửi; chúng chỉ vào hàng chờ sau khi phiên cha được duyệt và không tự rẽ tiếp. Khi bật chế độ này, folder đã chọn là phạm vi cho các nhánh, không tạo lặp task cha ở mọi folder. Các phiên chạy lần lượt; không tự gộp thay đổi giữa repo. Dừng/hủy từng phiên rõ ràng; hủy phiên cha không hoàn tác file hoặc hủy những phiên độc lập đã tạo.

Trong **Daily quota tasklist → Tận dụng quota hữu ích và chốt dừng Markdown**, chọn nhóm bảo trì hoặc đưa mẫu vào tasklist. Nhập/sửa [hướng dẫn chốt dừng](examples/maintenance/STOP-GATES.vi.md). Mỗi tổ hợp tài khoản/folder/nhóm việc chạy tối đa một lần trong ngày, trong trần quota, lượt gọi và thời gian. Thiếu quota sẽ chờ. Quyết định sản phẩm, kiến trúc, bảo mật hay đăng tải cần bạn trả lời; chỉ việc hữu ích độc lập mới tiếp tục. Backlog hữu hạn không bảo đảm dùng hết mọi token.

Phím mới: **Alt+Shift+D** mở phương hướng; **Alt+Shift+Q** xem tài khoản/hạn mức; **Alt+Shift+B** rẽ phiên đang chọn. **Ctrl+Enter** trong trình sửa hướng dùng để chọn hướng, trong trình sửa nhánh dùng để tạo phiên. **Escape** đóng phần đó và giữ bản nháp. Ô nhập chính giữ lựa chọn Enter/Shift+Enter hiện có. Có thể tùy chỉnh phím ở VS Code.
