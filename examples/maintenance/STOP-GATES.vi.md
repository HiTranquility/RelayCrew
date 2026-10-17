# Chốt dừng khi tận dụng quota

Nhập file ở Daily quota tasklist → Công việc hữu ích → Đính kèm .md chốt dừng.
Sửa phạm vi và tiêu chí phù hợp với repo trước khi bắt đầu.

## Việc có thể làm độc lập

- Đọc hướng dẫn repo trước. Chọn một việc nhỏ trong nhóm đã bật.
- Ưu tiên tái hiện bug, bổ sung kiểm thử hồi quy còn thiếu, khả năng truy cập,
  tài liệu cài đặt/ví dụ, xử lý hủy/thử lại hoặc nút thắt hiệu năng đã đo.
- Ghi đường dẫn thật, bằng chứng, kiểm tra đã chạy và điểm chưa chắc chắn.
- Không làm lặp lại việc đã xong hoặc bịa phát hiện để dùng quota.

## Dừng để hỏi chủ việc

Dừng trước khi quyết định hành vi sản phẩm, đổi API công khai/kiến trúc,
di chuyển/xóa dữ liệu, đổi thông tin đăng nhập/quyền, cài/nâng dependency,
đăng tải, triển khai hoặc gửi tin cho bên khác.

Khi cần quyết định như vậy, chỉ trả về:

```json
{"needs_owner":true,"question":"Việc cần quyết định; các lựa chọn, đánh đổi và khuyến nghị"}
```

Giữ task đó ở trạng thái chờ. Task bảo trì khác chỉ được tiếp tục nếu độc lập,
đúng phạm vi; không thực hiện, thông qua hoặc đi vòng quyết định đang chờ.

## Hoàn thành và giới hạn

- Tuân thủ tài khoản, quyền folder, trần quota, số lượt và hạn giờ đã đặt.
- Thiếu quota nghĩa là chưa rõ. Không bịa số token hoặc mặc định reset mỗi ngày.
- Hết việc hữu ích độc lập thì dừng; không gọi model hay lặp prompt vô nghĩa.
- Ghi rõ giả định và test chưa chạy. Checklist nghiệm thu do người dùng xác nhận.
- Hướng dẫn này không cấp thêm quyền hay thay thế giới hạn cố định của RelayCrew.
