# RelayCrew Markdown starter pack

Copy these files into your own project before editing. They contain no credentials, account IDs or fixed model IDs. Use your existing account/role assignments.

| Files | Where to use them |
|---|---|
| `roles/developer.md` | Setup → Input and response templates → Dev → Attach role .md |
| `roles/auditor.md` | Same editor → Audit |
| `roles/repair-worker.md` | Same editor → Repair |
| `roles/primary-manager.md` | Same editor → Lead / Primary manager |
| `roles/coordinator.md` | Same editor → Coordinator |
| `workflows/feature-delivery.md` | Setup → Workflow from Markdown → Preview → Apply |
| `workflows/bug-fix.md` | Same workflow importer |
| `workflows/quota-maintenance.md` | Workflow guide for bounded independent maintenance |
| `workflows/local-review.md` | Read-only review guide; attach the actual material separately |
| `tasks/feature-brief.md` | Fill in and attach to a Console team task |
| `tasks/definition-of-done.md` | Copy its checklist lines into the Console Definition of Done field |

Workflow files are plain Markdown guides. They do not change your account assignments, model policy, manager or permissions. Role files apply only to the role whose editor imports them; the extension's required response contract still applies. After attaching a role file, click **Save templates**. Changes affect new tasks; existing jobs retain their snapshots.

Replace `[placeholders]` with concrete requirements. Add a short task prompt in Console alongside any attachment. Attaching a Definition of Done file provides context; it does not automatically fill the acceptance UI. Copy the checklist lines into that field if you want checkboxes. They start unchecked and require your verification.

**Markdown examples** in Setup opens the bundled `examples` folder in your file manager. The same folder is included in the source download and installed VSIX. No sample runs automatically. API review has no repository tools; supply the relevant files/text and use read-only mode. Generated repository maintenance needs a CLI account.

## Tiếng Việt

Sao chép bộ mẫu vào project của bạn rồi sửa các phần `[điền nội dung]`. File trong `roles/` nhập bằng **Thiết lập → Mẫu đầu vào và phản hồi → chọn vai trò → Đính kèm .md**, sau đó lưu mẫu. File trong `workflows/` nhập bằng **Luồng từ Markdown → Xem trước → Áp dụng**. Các mẫu không đổi account, mô hình, quyền sửa hay người quản lý chính.

Điền `tasks/feature-brief.md`, rồi đính kèm vào Console cùng yêu cầu ngắn. Với `tasks/definition-of-done.md`, chép các dòng checklist vào ô **Tiêu chí hoàn thành** để có checkbox nghiệm thu; chỉ đính kèm file sẽ cung cấp ngữ cảnh, không tự điền bảng nghiệm thu.

Nút **Mẫu Markdown** mở thư mục mẫu đi kèm extension. Không có mẫu nào tự chạy. Dùng ngôn ngữ của người giao việc khi báo cáo; nêu rõ kết quả, bằng chứng, phần còn thiếu và việc tiếp theo. Quyết định quan trọng phải hỏi người dùng trước.
