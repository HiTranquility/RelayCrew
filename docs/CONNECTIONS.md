# Kết nối hai chiều · Telegram / Zalo

Mở sidebar RelayCrew → **Messaging · Telegram / Zalo**, hoặc lệnh **RelayCrew: Messaging Connections**.

Chưa có token/account nào được kết nối trên máy người dùng trong quá trình phát triển. Token được nhập qua ô password trong VS Code và lưu bằng SecretStorage theo workspace. Không gửi token cho agent trong cuộc chat.

## Telegram

1. Tạo bot qua [BotFather](https://t.me/BotFather), dùng bot riêng cho workspace này. Nhắn `/start` cho bot.
2. Chọn **Connect / update Telegram**; nhập bot token, chat ID và chế độ **Two-way chat + explicit task commands**.
3. Nhập user ID của bạn vào allowed sender. Cả chat ID và sender ID phải khớp mới nhận lệnh. ID là giá trị số, không phải username.
4. Chọn workspace nhận task. Chọn **Send test message**, rồi nhắn `/help` để kiểm tra hai chiều.

Bot dùng long polling `getUpdates`; không cần public server. Không dùng cùng bot với hệ thống webhook/runner khác: extension kiểm tra webhook hiện có và khóa poller giữa các workspace trên cùng máy. Không tự xóa webhook của bot. Polling reconnect có backoff khi mạng lỗi; sai token/conflict sẽ hiển thị trạng thái cần kết nối lại.

Không dùng bot chung giữa nhiều máy/VS Code profiles: lock local không bao phủ máy/profile khác. Tin chuyển tiếp, từ bot, sai sender và tin cũ quá 2 phút bị bỏ qua.

## Zalo Official Account

Adapter dùng **Zalo OA OpenAPI**, không dùng cookie hay đăng nhập tài khoản cá nhân.

1. Chuẩn bị Zalo App liên kết OA, quyền nhận/gửi tin, OA access token và UID của bạn đối với OA. Người nhận phải đủ điều kiện nhận tin theo chính sách OA.
2. Chọn **Connect / update Zalo OA**, nhập access token, UID và chọn **Two-way**.
3. Nhập App ID, OA ID, **OA webhook secret key**, và port local (mặc định `47731`). Không nhầm OA webhook secret với token gửi tin.
4. Thiết lập một endpoint **HTTPS** do bạn quản lý, chuyển tiếp request nguyên vẹn tới `http://127.0.0.1:47731/zalo/webhook`. Đăng ký endpoint đó trong Zalo Developer và bật sự kiện `user_send_text`.
5. Reverse proxy phải giữ nguyên raw JSON body và header `X-ZEvent-Signature`. Extension kiểm tra SHA-256 của `appId + rawBody + timestamp + OA secret`, timestamp trong 5 phút, App ID, OA ID và sender UID đã cho phép.
6. Chọn **Send test message**, gửi `/help` tới OA và xem phần hội thoại trong board.

Local server chỉ bind `127.0.0.1`; extension không tự mở firewall, tạo public tunnel hay triển khai hosting. Bạn cần cấu hình HTTPS forwarding riêng để Zalo gọi vào. Token hết hạn cần cập nhật qua Connect; bản này chưa tự làm OAuth refresh.

Gửi tin qua endpoint `/v3.0/oa/message/cs` chịu quyền/tương tác/hạn mức của OA. Đây không phải kênh gửi tin bất kỳ vô thời hạn; API có thể từ chối dù webhook nhận được tin.

## Cách nói chuyện với agent

| Tin nhắn | Kết quả |
|---|---|
| Câu hỏi tự nhiên hoặc `/ask ...` | Lead trả lời read-only, có ngữ cảnh 8 lượt gần nhất |
| `/task yêu cầu và acceptance criteria` | Tạo task cho flow đang chọn; quyền sửa theo Allow Edits |
| `/status`, `/tasks` | Xem trạng thái, ID task, câu hỏi owner và quota |
| `/reply ID câu trả lời` | Trả lời agent đang `waiting_owner`; tiếp tục đúng bước |
| `/cancel ID` | Dừng task, giữ các file đã sửa |
| `/resume ID` | Chủ động chạy lại bước chờ quota sau khi xem thay đổi dở và cập nhật quota |
| `/help` | Hướng dẫn |

ID có thể dùng prefix duy nhất ít nhất 6 ký tự. Task bị giới hạn vào workspace đã chọn cho kênh đó. Câu hỏi tự nhiên không tự biến thành quyền sửa code.

Agent trong pipeline có thể trả `{"needs_owner":true,"question":"..."}`: task dừng ở bước đó, câu hỏi xuất hiện trong extension và các kênh đã bật. Trả lời qua nút **Reply to Agent** hoặc `/reply`. Các bước đã xong không chạy lại.

## Gửi tin và lưu dữ liệu

Task hoàn thành, lỗi, chờ owner, chờ quota, alert quota và reminder được đưa vào outbox lưu bền. Không gửi log/source file toàn bộ mặc định; thông báo kết quả có bản tóm tắt phản hồi lead. Bạn có thể xem input/output và hội thoại trong Assignment Board.

Message ID được lưu để chống xử lý trùng. Request đang xử lý lúc host chết không tự thực thi lại; hỏi `/status` trước khi gửi lại task. Delivery có kết quả mạng không rõ được ghi `uncertain`, không tự gửi lại; rate-limit có phản hồi từ API được retry có giới hạn. Đây không phải cam kết exactly-once qua mạng.

Chọn **Connection status / deliveries** xem gửi thành công/lỗi; **Disconnect channel** dừng nhận tin và xóa credential của kênh. Hội thoại/outbox lịch sử vẫn nằm trong workspace storage và backup local; chưa có retention UI.

VS Code và workspace cần mở. Khi pause hàng đợi, `/task` vẫn được nhận và xếp hàng; câu hỏi read-only và `/status` vẫn có thể được trả lời. Khi đóng VS Code, polling/webhook local ngừng.

## Tài liệu chính thức

- [Telegram Bot API · getUpdates](https://core.telegram.org/bots/api#getupdates), [sendMessage](https://core.telegram.org/bots/api#sendmessage).
- [Zalo OA · loại tin, điều kiện tương tác](https://oa.zalo.me/home/documents/vie/guides/tong-quan-cac-loai-tin-nhan-tren-zalo-official-account-_3651713298729094511).
- [Zalo Developer · webhook signature](https://stc-developers.zdn.vn/docs/v2/official-account/webhook/quan-ly/su-kien-tao-nhan).
