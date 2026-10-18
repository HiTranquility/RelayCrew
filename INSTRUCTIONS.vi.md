# Hướng dẫn dùng RelayCrew

[English](INSTRUCTIONS.md) · [Tổng quan](README.vi.md)

Hướng dẫn cho RelayCrew 1.0.1. Gói cũ có thể chưa có đủ các nút bên dưới.

## thiết lập trước khi mở Live

Vào **Chuẩn bị chạy**, đi theo bốn bước: **Tài khoản và mô hình → Phân vai và giao việc → Prompt và Markdown → Kiểm tra và mở Live**. Lưu ở từng trình chỉnh sửa. Bước kiểm tra hiện nhóm đã lưu và nhắc nếu còn bản nháp. Markdown không bắt buộc: dùng prompt mẫu, thêm hướng dẫn từng vai trò hoặc nhập quy trình cả nhóm. Mở ô nhập chưa chạy nhiệm vụ; bạn bấm Gửi khi sẵn sàng.

Trong Live, **Hội thoại**, **Agents và luồng chạy**, **File thay đổi**, **Nhật ký kỹ thuật** có nút bật/tắt riêng. **×** ẩn một phần; **Hiện tất cả** khôi phục. **Thu gọn nội dung** giữ lại tiêu đề phiên. Bố cục được giữ khi có dữ liệu mới hoặc mở lại workspace. **Mở tab phiên trực tiếp** tách phiên thành tab VS Code; kéo sang nhóm/cửa sổ khác hoặc dùng **Chuyển sang cửa sổ mới**. **Đóng cửa sổ** chỉ đóng tab quan sát; dùng **Dừng tác vụ** nếu muốn dừng agent.

Xem [demo agent con thật và phím tắt sơ đồ](docs/NATIVE-AGENT-DEMO.md). Một số CLI không gửi mã agent con; giao diện ghi rõ giới hạn này và giữ báo cáo của Dispatcher trong Hội thoại.

## 1. Kết nối tài khoản

Vào **Tài khoản & hạn mức**, thêm hoặc sửa profile rồi dùng **Cài CLI**, **Đăng nhập**, **Kiểm tra kết nối** khi cần. Extension kiểm tra CLI đã có trên máy và hỏi trước khi cài. Bạn tự hoàn tất đăng nhập ở terminal/trình duyệt. Kết nối thành công chưa đồng nghĩa tài khoản dùng được mọi model.

Nhập khóa ở phần secret của extension; đừng bỏ vào prompt, file Markdown hoặc settings đem lên Git. Cloud/local là nơi model chạy; CLI/HTTP là cách kết nối. Review qua HTTP cần bạn cung cấp ngữ cảnh và không có công cụ đọc repo.

### Nhiều tài khoản và khôi phục

Vào **Tài khoản và quota → Thêm nhiều tài khoản**, mỗi dòng một email. Email đầu được ưu tiên cho mẫu mới. Profile Codex/Claude có thư mục đăng nhập riêng: đăng nhập từng profile. Email mới nhập chưa phải danh tính đã xác minh. Các profile Google Antigravity hiện dùng chung phiên CLI; tự đổi đăng nhập qua nút mở CLI. Xem [giới hạn tài khoản Antigravity](docs/ANTIGRAVITY.md#multiple-google-accounts).

**Kế hoạch dự phòng và khôi phục** cho biết tài khoản hiện tại, ai được nhận bước tiếp theo và lý do tài khoản nào chưa đủ điều kiện. Có thể loại tài khoản khỏi dự phòng, chọn nhóm theo vai trò, bật tự chuyển sang đăng nhập độc lập hoặc chờ quota mới. Thử lại bước bị nhà cung cấp giới hạn cần bật riêng vì file có thể đã thay đổi. Khôi phục giữ các bước hoàn tất, chỉ chạy lại bước dang dở trong phiên cũ với cùng model/suy luận và quyền; không tạo nhánh chạy trùng. Lịch sử đổi tài khoản hiện trong Live, tối đa ba lượt bị giới hạn cho mỗi bước. Vai trò quản lý/kiểm định/daily cần đổi tài khoản chủ động.

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


## danh tính và hạn mức thật

Trong **Tài khoản & hạn mức**, danh sách có nút **Đăng nhập**, **Kiểm tra kết nối**, **Mức dùng và hạn mức** ngay cạnh từng profile. Lần mở bảng đầu tiên tự kiểm tra CLI nền; nút Kiểm tra kết nối cho phép thử lại. Đọc dữ liệu từ CLI, không gửi prompt gọi model. Phân vai, secret và quota thủ công nằm trong phần cài đặt tài khoản nâng cao. Codex trả email/gói và các kỳ quota qua app-server; số đo tự làm mới trên thanh hạn mức. Claude trả email/gói qua `auth status`; xem hạn mức bằng `/usage` trong Claude Code. Antigravity trả quota theo nhóm model qua `/usage`, chưa trả email đăng nhập: các profile Google dùng chung số đo, không có quota riêng đã xác minh. Nếu email tự khai báo khác email Codex đang đăng nhập thì không dùng quota đó để điều phối profile. Phần trăm chưa phải số token chính xác; chưa có dữ liệu vẫn ghi chưa rõ. Nguồn quota thủ công/file có nhãn riêng.


## Bản thử sau 1.0.1: manager chính, nhiều tab Live và review conventions hữu hạn

Trang phân vai có bộ chọn **Manager quyết định chính** và nút **Chọn làm chính** ở từng manager hỗ trợ. Chuyển một thành viên đang có sang chính sẽ hoán đổi ghế chủ trì/hỗ trợ, giữ chính sách biểu quyết, người biểu quyết và tên. Chọn tài khoản ngoài đội sẽ thay ghế chủ trì. Lưu đội để áp dụng cho task mới; phiên đang chạy giữ phân công đã ghi. Tài khoản ưu tiên theo nhà cung cấp là khái niệm riêng: dùng cho mẫu mới, chưa tự đổi phiên đăng nhập hoặc task đã lưu.

Trong Console, **Mở các phiên Live riêng** cho mở từng task ở tab/cửa sổ riêng, hoặc chọn tối đa bốn tab một lần. Kéo tab VS Code nằm cạnh nhau. Mỗi tab gắn đúng task, kể cả dừng, trả lời câu hỏi và mở file/sơ đồ. Trả lời trực tiếp bằng Ctrl+Enter; bản nháp và mã thử lại độc lập. Câu hỏi đã đổi thì phải xác nhận lại trước khi dùng câu trả lời cũ. Nhiều màn hình quan sát chưa có nghĩa là nhiều agent cùng sửa: mỗi workspace vẫn chạy task lần lượt.

Ở **Prompt và Markdown → Audit → Mẫu bắt đầu**, chọn **Auditor conventions**, xem hướng dẫn rồi **Lưu toàn bộ mẫu**. Hai file mẫu trong `examples/roles/` yêu cầu đọc từng hunk thay đổi, đối chiếu luật gốc của đúng repo, ghi file:dòng, tiêu chí và phần BLOCKED/NOT RUN. Test pass không thay cho đọc code; sở thích cá nhân chưa phải quy chuẩn bắt buộc.

**Thiết lập → Nâng cao → Số vòng code/review tối đa** mặc định 3, chỉnh 1–10. Task code mới và Daily lưu trần riêng. Sau mỗi đợt sửa có auditor kiểm lại. Với luồng lập kế hoạch, kế hoạch đứng trước vòng 1; kiểm code diễn ra sau thực thi. Một vòng có thể gồm nhiều việc sửa hữu hạn. Còn việc sửa khi đã hết vòng, hoặc bước code bị gọi lại tới trần, thì dừng ở Cần xử lý. Đưa lại vào hàng chờ, reload hay đổi account không reset trần. Báo cáo giữ các lần thử/finding; cần tiếp thì chủ việc cho phép task hữu hạn mới. Trần này áp dụng cho vòng RelayCrew và lượt gọi bước code, không đếm từng lệnh nội bộ của CLI. Demo chỉ đọc và task cũ giữ cách chạy ban đầu.

## Xem thử phân nhánh và agent hỏi lại

Từ thư mục source, chạy `npm run demo`, mở địa chỉ localhost được in ra. Kịch bản tiếng Việt này không cần tài khoản, không gọi model và không tiêu quota. Chọn 2–6 Executor, mỗi Executor 1–2 nhánh con minh họa, tối đa 12 nhánh con. Worker chạy tuần tự; nhánh con minh họa xử lý song song. Executor đầu tiên hỏi phạm vi và chờ bạn trả lời. Có Tạm dừng, Đi một bước, Dừng, kéo tỷ lệ hai pane, đổi kiểu map và tải báo cáo. Đây không phải bằng chứng subagents CLI thật đã chạy hay code đã được kiểm chứng. Quan sát con thật vẫn phụ thuộc sự kiện công khai do CLI cung cấp trong task thật đã được phép. Tùy chọn `--recording path.json` chỉ mở một bản ghi cục bộ đã kết thúc để xem; giữ file đó riêng trên máy.

Trong demo browser, **Thêm → Giao diện** chọn tối, sáng hoặc theo hệ thống, đồng bộ cho cả hai pane. Bản nhúng chỉ có một ô trả lời ở trên; cửa sổ Live riêng dùng ô nhập riêng trong luồng trang. Map nhiều agent ưu tiên thẻ đọc rõ; dùng Vừa khung khi muốn nhìn toàn cảnh. Menu Thêm còn có mở riêng và tải báo cáo. Tùy chọn `--live-recording path.json` theo dõi file kết quả của một runner CLI chỉ đọc đang chạy; đây là màn hình quan sát, không dừng hay trả lời thay runner, không thực thi hay sửa file nguồn đó.

### Tách khung xem và kiểm soát thư mục (preview.4)

Trong phòng demo trên trình duyệt, nút **Tách Live** / **Tách Map** nằm ngay đầu từng khung. Nút mở đúng phiên ở cửa sổ hoặc tab riêng tùy trình duyệt; nếu popup bị chặn, bấm liên kết dự phòng. **× Ẩn** chỉ ẩn khung, dùng **Cả hai pane / Map / Live** để hiện lại. Đóng khung xem không dừng tác vụ và không xóa bản nháp ở màn hình chính.

Nút **Thư mục** cho xem đường dẫn thực thi, thư mục gốc, nhánh worktree và chính sách quyền đã giao; có thể chuyển phiên theo folder. Trang trình duyệt chỉ quan sát, không cấp quyền truy cập file.

Trong VS Code, mở **Thư mục & quyền** ngay trong Live. **Mở thư mục trong Explorer** mở đường dẫn thực thi của phiên. **Task mới / chọn thư mục** mở composer và bung sẵn phần nhiều folder; chọn **Chọn thêm thư mục**, đánh dấu folder và quyền trước khi gửi. Việc này chuẩn bị task mới, giữ nguyên phạm vi của phiên đang chạy và bản nháp đang soạn.

### Bố trí sơ đồ và agent con thật (preview.5)

Trong Sơ đồ, chọn **Bố trí → Tự động / Ngang / Dọc**. Mỗi phiên lưu hướng riêng. Đổi hướng sẽ xếp lại các thẻ; cập nhật Live giữ vị trí bạn đã kéo. Mũi tên thể hiện cả phụ thuộc thực thi và agent cha thực tế. Có thể kéo thẻ, dùng Alt+phím mũi tên hoặc Vừa khung để quan sát.

Một số CLI Codex lưu hoạt động con trong phiên nhưng không gửi collaboration item qua exec JSON. Với lượt đã bật agent con thật, RelayCrew đọc thêm lịch sử đúng ID phiên bằng `thread/read`; không resume hay tạo lượt model. Chỉ hiện ID con, trạng thái, model/mức suy luận và giao việc/câu trả lời công khai đã xác minh. Không hiển thị reasoning; thiếu dữ liệu thì ghi nhận thiếu. Vẫn giữ trần agent con đã thiết lập.

### Xem rõ quy trình và chi tiết Live

**Quy trình thực thi** trong Live thể hiện các bước và bàn giao đã ghi nhận. Bấm đúp agent trong Sơ đồ, Danh sách, Bảng hoặc Phụ thuộc để mở chi tiết tự cập nhật. **Đang xử lý gì** cho xem nhiệm vụ, thư mục thật, thông báo công khai gần nhất, file được nhắc và lệnh được ghi nhận. File được nhắc chưa đồng nghĩa đã sửa; xem **File thay đổi** để đối chiếu dữ liệu Git.

Popup giữ tab, vị trí cuộn và báo cáo đang mở khi có snapshot mới. **Tạm dừng xem** chỉ giữ khung quan sát, tác vụ vẫn chạy. **Tiếp tục xem** nhận dữ liệu mới nhất. **Kết quả / Đầu vào / Hoạt động** tách câu trả lời, giao việc chính xác và tiến trình/công cụ công khai. Độ chi tiết nhánh con tùy dữ liệu CLI ghi nhận; không hiển thị suy luận riêng.

Code có nhãn ngôn ngữ/file, số dòng và nút sao chép nguyên code, không kèm số dòng. Báo cáo dài có nút **Đọc toàn bộ báo cáo**; quyết định và vấn đề audit được trình bày riêng. Bản phản hồi CLI gốc và báo cáo tải xuống được giữ nguyên.
