# RelayCrew

[English](README.md) · **Tiếng Việt**

**Điều phối đội AI lập trình ngay trong VS Code.**

Giao việc, chọn ai lập trình, lập kế hoạch, kiểm tra và quản lý; sau đó quan sát đội làm việc trực tiếp. RelayCrew kết nối tài khoản Codex, Claude, Antigravity/Gemini hoặc model local của bạn. Một tài khoản có thể đảm nhận nhiều vai trò.

- **Biết ai đang làm gì:** xem trao đổi công khai, bàn giao và kết quả qua sơ đồ, danh sách, bảng hoặc các bước phụ thuộc.
- **Tự chỉnh đội:** chọn mẫu rồi đổi vai trò, tên, prompt và hướng dẫn Markdown. Không bắt buộc nhập model ID.
- **Giữ quyền điều khiển:** tạm dừng, trả lời câu hỏi, đổi tài khoản và đặt trần sử dụng. Theo dõi đầu việc và checklist nghiệm thu riêng.
- **Sắp xếp công việc:** hẹn giờ, xử lý backlog hữu ích theo quota, chia thư mục dự án và kết nối nhắn tin khi cần.

Bản **1.0.1** có hướng dẫn chuẩn bị trước khi chạy, danh sách tài khoản gọn với nút đăng nhập/kiểm tra/hạn mức ngay bên cạnh, màu trạng thái rõ hơn và sơ đồ agent có thể phóng lớn. Dữ liệu đăng nhập/quota được đọc từ CLI khi có hỗ trợ; các email Antigravity chưa phải những phiên đăng nhập độc lập đã xác minh.

## Dùng thử

1. Cài file VSIX trong [Releases](https://github.com/HiTranquility/RelayCrew/releases), rồi mở project tin cậy trong VS Code.
2. Vào **RelayCrew → Chuẩn bị chạy**: kết nối tài khoản, phân vai, thêm Markdown nếu cần và kiểm tra kế hoạch đã lưu.
3. Trong **Tài khoản & hạn mức**, dùng nút cạnh từng tài khoản để đăng nhập, kiểm tra kết nối và xem mức dùng/giờ reset khi CLI hỗ trợ.
4. Gửi một nhiệm vụ nhỏ với tiêu chí hoàn thành rõ ràng. Bấm agent để xem công việc; dùng **Tạm dừng** khi cần.

RelayCrew **1.0.1** có phương hướng AI để bạn sửa và chọn, thanh hạn mức thường trực, nhánh phiên có giới hạn, panel trực tiếp/bản đồ/file kéo được và chốt dừng Markdown cho việc hữu ích. **Giả lập luồng** không gọi model; đề xuất và demo thật có dùng quota.

## Tự thiết lập

Đọc [hướng dẫn sử dụng](INSTRUCTIONS.vi.md) để chỉnh luồng, model, giới hạn phân việc, file Markdown và chạy demo giám sát. Có sẵn [bộ mẫu Markdown](examples/README.md) để chép vào dự án rồi sửa.

Chi tiết: [Console và panel](docs/CONSOLE.md) · [Đầu việc và lịch chạy](docs/OPERATIONS.md) · [Model và prompt](docs/MODELS-AND-TEMPLATES.md) · [Đóng góp](CONTRIBUTING.md).

RelayCrew đang ở giai đoạn đầu, ưu tiên chạy cục bộ. Model và thông tin quota phụ thuộc nhà cung cấp. Các nhiệm vụ worker hiện chạy lần lượt, một cấp; màn hình chỉ hiển thị trao đổi công khai. Kết nối nhắn tin cần cấu hình riêng.

[Giấy phép MIT](LICENSE)

[Hành vi thực tế, hỗ trợ tài khoản và phục hồi](docs/CURRENT-BEHAVIOR.md). Thiết lập → xem lại kế hoạch → xác nhận → quan sát → kiểm chứng kết quả.
